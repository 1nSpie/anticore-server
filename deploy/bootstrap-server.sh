#!/usr/bin/env bash
# Подготовка сервера к выкладке в Docker. Запускать ОДИН раз, на сервере:
#
#   sudo bash bootstrap-server.sh [/путь/к/текущему/.env/бэка]
#
# Что делает: ставит Docker (если его нет), создаёт пользователя `deploy` для GitHub Actions и кладёт
# его SSH-ключ, создаёт /opt/anticore с docker-compose.yml и env-файлами.
# Если передан путь к текущему .env бэка — собирает из него server.env (без кавычек, с раскрытым DATABASE_URL).
# Что НЕ делает: не трогает pm2, nginx, базу и работающий сайт. Можно запускать повторно (ничего не затирает).
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DIR="${DIR:-/opt/anticore}"
CI_PUBKEY="${CI_PUBKEY:-ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILDfNoV1Za+kMmveiSRp0y7Mf0j533h++zWxkyCXzuRv github-actions-anticore-deploy}"
OLD_ENV="${1:-}"

[ "$(id -u)" = "0" ] || { echo "Запусти через sudo: sudo bash $0 [.env]" >&2; exit 1; }
[ -z "$OLD_ENV" ] || [ -f "$OLD_ENV" ] || { echo "Нет файла $OLD_ENV" >&2; exit 1; }

echo "== 1/5 Docker"
if command -v docker >/dev/null 2>&1; then
  echo "уже установлен: $(docker --version)"
else
  . /etc/os-release
  case "$ID" in ubuntu|debian) ;; *) echo "Скрипт рассчитан на Ubuntu/Debian, у тебя $ID — поставь Docker вручную" >&2; exit 1 ;; esac
  apt-get update -y
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$ID $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi
docker compose version >/dev/null

echo "== 2/5 Пользователь $DEPLOY_USER для CI"
id "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"
# Пользователь, запустивший sudo, тоже получает доступ к docker (нужен для cutover.sh). Заработает после нового входа по ssh.
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then usermod -aG docker "$SUDO_USER"; fi
SSH_DIR="/home/$DEPLOY_USER/.ssh"
install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$SSH_DIR"
touch "$SSH_DIR/authorized_keys"
grep -qxF "$CI_PUBKEY" "$SSH_DIR/authorized_keys" || echo "$CI_PUBKEY" >> "$SSH_DIR/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "$SSH_DIR/authorized_keys"
chmod 600 "$SSH_DIR/authorized_keys"

echo "== 3/5 Папка $DIR"
install -d -m 0750 -o "$DEPLOY_USER" -g docker "$DIR"

echo "== 4/5 docker-compose.yml и .env.deploy"
cat > "$DIR/docker-compose.yml" <<'COMPOSE_EOF'
# Кладётся на сервер в /opt/anticore (или другую папку — для стенда) вместе с .env.deploy, server.env, client.env.
# Исходников на сервере нет — только готовые образы из GHCR.
#
# network_mode: host — контейнеры слушают те же порты, что раньше pm2 (API — PORT из server.env, фронт — CLIENT_PORT),
# поэтому nginx и Postgres на хосте не перенастраиваются (DATABASE_URL с localhost работает).
#
# Стенд на одном сервере с продом: отдельная папка (например /opt/anticore-stand), другие PORT в server.env
# и CLIENT_PORT в .env.deploy, чтобы порты не пересекались.

services:
  server:
    image: ghcr.io/1nspie/anticore-server:${SERVER_TAG:-latest}
    network_mode: host
    env_file: server.env
    restart: unless-stopped
    # `docker compose up --wait` и деплой в CI ждут, пока API ответит на /api/health
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - "fetch('http://127.0.0.1:'+(process.env.PORT||4444)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
    logging:
      driver: json-file
      options: { max-size: "20m", max-file: "5" }

  client:
    image: ghcr.io/1nspie/anticore-client:${CLIENT_TAG:-latest}
    network_mode: host
    env_file: client.env
    environment:
      PORT: "${CLIENT_PORT:-3000}"
      # Только локально — наружу отдаёт nginx
      HOSTNAME: "127.0.0.1"
    restart: unless-stopped
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    logging:
      driver: json-file
      options: { max-size: "20m", max-file: "5" }
COMPOSE_EOF
if [ ! -f "$DIR/.env.deploy" ]; then
  printf 'SERVER_TAG=latest\nCLIENT_TAG=latest\nCLIENT_PORT=3000\n' > "$DIR/.env.deploy"
fi
if [ ! -f "$DIR/client.env" ]; then
  # Адреса NEXT_PUBLIC_* вшиты в образ при сборке; здесь только runtime-переменные
  printf 'SITE_LINK=https://xn--80aaag6amsblus.xn--p1ai\nUSE_YANDEX_METRICS=true\n' > "$DIR/client.env"
fi

echo "== 5/5 server.env"
if [ -f "$DIR/server.env" ]; then
  echo "server.env уже есть — не трогаю"
elif [ -n "$OLD_ENV" ]; then
  OLD_ENV="$OLD_ENV" OUT="$DIR/server.env" python3 - <<'PY'
import os, re, sys
src, out = os.environ["OLD_ENV"], os.environ["OUT"]
vars_ = {}
for raw in open(src, encoding="utf-8"):
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    k = k.strip()
    if k.startswith("export "):
        k = k[7:].strip()
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        v = v[1:-1]
    # раскрываем ${VAR} уже прочитанными значениями (Docker env_file этого не умеет)
    v = re.sub(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}", lambda m: vars_.get(m.group(1), ""), v)
    vars_[k] = v
if not vars_.get("DATABASE_URL") and all(vars_.get(x) for x in ("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DATABASE")):
    vars_["DATABASE_URL"] = "postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DATABASE}?schema=public".format(**vars_)
# служебное и устаревшее в образ не переносим
skip = re.compile(r"^(NODE_ENV|POSTGRES_[A-Z]+|CRM_ADMIN_[A-Z]+)$")
vars_["PORT"] = "4444"
with open(out, "w", encoding="utf-8") as f:
    for k, v in vars_.items():
        if not skip.match(k):
            f.write(f"{k}={v}\n")
print("Перенесено переменных:", len([k for k in vars_ if not skip.match(k)]))
print("Имена:", ", ".join(k for k in vars_ if not skip.match(k)))
if not vars_.get("DATABASE_URL"):
    print("!! DATABASE_URL не найден — допиши его в server.env вручную", file=sys.stderr)
PY
else
  install -m 0640 /dev/null "$DIR/server.env"
  echo "Создан ПУСТОЙ server.env — заполни его по deploy/server.env.example"
fi

chown "$DEPLOY_USER:docker" "$DIR"/docker-compose.yml "$DIR"/.env.deploy "$DIR"/client.env "$DIR"/server.env
chmod 0644 "$DIR/docker-compose.yml"
chmod 0640 "$DIR"/.env.deploy "$DIR"/client.env "$DIR"/server.env

cat <<DONE

Готово. Дальше:
  1. Проверь $DIR/server.env (значения секретов не печатаю): DATABASE_URL, JWT_SECRET, ADMIN_*, FRONTEND_BASE_URL.
  2. В GitHub запусти Run workflow (environment=production, pull_only=true) для anticore-server, затем anticore-client.
  3. Выйди и зайди по ssh заново (чтобы заработала группа docker) и выполни: bash cutover.sh
DONE
