#!/usr/bin/env bash
# Бэкап базы данных: pg_dump → проверка архива → ротация старых копий.
# Ставится на сервер скриптом install-backup.sh и запускается cron'ом каждую ночь от root.
# Вручную:  sudo /usr/local/bin/anticore-backup
#
# Копии лежат в /var/backups/anticore (доступ только у root), имя anticore-ГГГГ-ММ-ДД_ЧЧММ.dump.
# Формат custom (-Fc) — уже сжат; восстановление: pg_restore (см. deploy/README.md, раздел «Бэкап базы»).
set -euo pipefail
umask 077

SERVER_ENV="${SERVER_ENV:-/opt/anticore/server.env}"   # откуда берём DATABASE_URL
BACKUP_DIR="${BACKUP_DIR:-/var/backups/anticore}"
KEEP_DAYS="${KEEP_DAYS:-14}"                            # хранить копии не старше N дней…
KEEP_MIN="${KEEP_MIN:-5}"                               # …но не меньше N последних (даже если старые)
MIN_FREE_MB="${MIN_FREE_MB:-1024}"                      # меньше свободного места — не начинаем
PING_URL="${PING_URL:-}"                                # необязательно: URL мониторинга (healthchecks.io и т.п.)
LOCK="${LOCK:-/var/lock/anticore-backup.lock}"

log() { echo "$(date '+%F %T') $*"; }
ping_monitor() { [ -n "$PING_URL" ] && curl -fsS -m 10 --retry 2 -o /dev/null "$PING_URL$1" || true; }

# Не запускать второй экземпляр, если прошлый ещё идёт
exec 9>"$LOCK"
flock -n 9 || { log "Уже выполняется другой бэкап — пропускаю"; exit 0; }

fail() { log "ОШИБКА: $*"; ping_monitor "/fail"; exit 1; }
trap 'rm -f "${TMP:-}"' EXIT

command -v pg_dump >/dev/null && command -v pg_restore >/dev/null || fail "нет pg_dump/pg_restore (sudo apt install -y postgresql-client)"
[ -r "$SERVER_ENV" ] || fail "не могу прочитать $SERVER_ENV"
URL="$(grep -m1 '^DATABASE_URL=' "$SERVER_ENV" | cut -d= -f2-)"
[ -n "$URL" ] || fail "в $SERVER_ENV нет DATABASE_URL"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
FREE_MB="$(df -Pm "$BACKUP_DIR" | awk 'NR==2 {print $4}')"
[ "$FREE_MB" -ge "$MIN_FREE_MB" ] || fail "мало места: свободно ${FREE_MB} МБ, нужно минимум ${MIN_FREE_MB}"

FINAL="$BACKUP_DIR/anticore-$(date +%F_%H%M).dump"
TMP="$FINAL.partial"
# pg_dump не понимает параметр ?schema=public из строки Prisma — отрезаем
pg_dump "${URL%%\?*}" --format=custom --no-owner --file="$TMP" || fail "pg_dump завершился с ошибкой"

# Архив должен читаться и быть не пустым — иначе это не бэкап
[ -s "$TMP" ] || fail "получился пустой файл"
pg_restore --list "$TMP" >/dev/null || fail "архив не читается (pg_restore --list)"
mv "$TMP" "$FINAL"

# Ротация: удаляем старше KEEP_DAYS дней, но всегда оставляем KEEP_MIN последних
PROTECTED="$(ls -1t "$BACKUP_DIR"/anticore-*.dump 2>/dev/null | head -n "$KEEP_MIN")"
REMOVED=0
while IFS= read -r old; do
  [ -n "$old" ] || continue
  grep -qxF "$old" <<<"$PROTECTED" && continue
  rm -f "$old" && REMOVED=$((REMOVED + 1))
done < <(find "$BACKUP_DIR" -maxdepth 1 -name 'anticore-*.dump' -mtime "+$KEEP_DAYS")

COUNT="$(ls -1 "$BACKUP_DIR"/anticore-*.dump | wc -l)"
log "OK: $FINAL ($(du -h "$FINAL" | cut -f1)); копий в хранилище: $COUNT, удалено старых: $REMOVED, свободно: ${FREE_MB} МБ"
ping_monitor ""
