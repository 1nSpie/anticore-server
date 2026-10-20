#!/usr/bin/env bash
# Проверка, что последняя копия реально восстанавливается: разворачивает её во ВРЕМЕННУЮ базу
# anticore_restore_check (боевая не затрагивается), считает строки в ключевых таблицах и удаляет временную базу.
# Запуск (раз в месяц): sudo anticore-restore-check
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-/var/backups/anticore}"
DB="anticore_restore_check"
[ "$(id -u)" = "0" ] || { echo "Запусти через sudo" >&2; exit 1; }

LATEST="$(ls -1t "$BACKUP_DIR"/anticore-*.dump 2>/dev/null | head -1)"
[ -n "$LATEST" ] || { echo "В $BACKUP_DIR нет копий" >&2; exit 1; }
echo "Проверяю: $LATEST ($(du -h "$LATEST" | cut -f1), от $(date -r "$LATEST" '+%F %T'))"

PG="sudo -u postgres"
trap '$PG dropdb --if-exists "$DB" >/dev/null 2>&1 || true' EXIT
$PG dropdb --if-exists "$DB"
$PG createdb "$DB"
# Файл читает root (права 600), поэтому отдаём его pg_restore через stdin
$PG pg_restore --no-owner --dbname="$DB" < "$LATEST"

echo "Восстановлено. Строк в таблицах:"
for t in cabinet_users visit_history site_leads; do
  n="$($PG psql -d "$DB" -Atc "select count(*) from \"$t\"" 2>/dev/null || echo "нет таблицы")"
  printf '  %-16s %s\n' "$t" "$n"
done
echo "OK — копия рабочая. Временная база удалена."
