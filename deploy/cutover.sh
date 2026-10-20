#!/usr/bin/env bash
# Переключение прода с pm2 на Docker. Запускать на сервере под пользователем, у которого работает pm2
# (и который состоит в группе docker — её даёт bootstrap-server.sh после нового входа по ssh):
#
#   bash cutover.sh
#
# Перед запуском: 1) выполнен bootstrap-server.sh; 2) в GitHub запущен workflow с pull_only=true для сервера и клиента
# (образы скачаны, теги записаны в .env.deploy).
# Скрипт: делает дамп базы → показывает статус миграций → применяет их → останавливает pm2 → поднимает контейнеры.
# Не поднялись — сам вернёт pm2 (сайт будет недоступен считанные секунды). Миграции только добавляют, старый код с ними работает.
set -euo pipefail

DIR="${DIR:-/opt/anticore}"
cd "$DIR"
C="docker compose --env-file .env.deploy"

command -v pm2 >/dev/null || { echo "pm2 не найден: запускай под пользователем, у которого работает pm2" >&2; exit 1; }
docker ps >/dev/null 2>&1 || { echo "Нет доступа к docker: зайди по ssh заново (группа docker) или запусти через sudo" >&2; exit 1; }
command -v pg_dump >/dev/null || { echo "Нет pg_dump: sudo apt install -y postgresql-client" >&2; exit 1; }
grep -q '^SERVER_TAG=[0-9a-f]\{40\}$' .env.deploy || echo "! SERVER_TAG не sha — workflow с pull_only для сервера не запускался? Тогда образ тянется как latest."

echo "== Процессы pm2:"
pm2 list
read -rp "Какие процессы pm2 остановить (имена через пробел): " APPS
[ -n "$APPS" ] || { echo "Ничего не выбрано — стоп" >&2; exit 1; }

echo "== 1/5 Бэкап базы"
URL="$(grep '^DATABASE_URL=' server.env | head -1 | cut -d= -f2-)"
[ -n "$URL" ] || { echo "В server.env нет DATABASE_URL" >&2; exit 1; }
DUMP="$HOME/anticore-before-docker-$(date +%F-%H%M).dump"
# pg_dump не понимает параметр ?schema=public из строки Prisma — отрезаем
pg_dump "${URL%%\?*}" -Fc -f "$DUMP"
echo "Дамп: $DUMP ($(du -h "$DUMP" | cut -f1))"

echo "== 2/5 Статус миграций (из образа)"
$C run --rm --no-deps server npx prisma migrate status || true
read -rp "Статус «up to date» или в списке только свежие миграции? Продолжать? [y/N] " ANSWER
[ "$ANSWER" = "y" ] || { echo "Остановлено. Если просит накатить старые миграции — см. deploy/README.md, п. «Миграции Prisma»."; exit 1; }

echo "== 3/5 Применяю миграции"
$C run --rm --no-deps server npx prisma migrate deploy

echo "== 4/5 Останавливаю pm2: $APPS"
pm2 stop $APPS

echo "== 5/5 Поднимаю контейнеры"
if $C up -d --wait --wait-timeout 120; then
  $C ps
  echo
  echo "Контейнеры healthy. Проверь сайт в браузере и админку."
  echo "Всё хорошо → удали старые процессы:  pm2 delete $APPS && pm2 save"
  echo "Что-то не так → вернуться:           $C down && pm2 start $APPS"
else
  echo "Контейнеры не поднялись — возвращаю pm2" >&2
  $C logs --tail 40 || true
  $C down || true
  pm2 start $APPS
  exit 1
fi
