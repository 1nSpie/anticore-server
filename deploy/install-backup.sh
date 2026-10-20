#!/usr/bin/env bash
# Устанавливает ежедневный бэкап БД на сервере. Запускать один раз:
#
#   sudo bash install-backup.sh
#
# Что делает: ставит postgresql-client (если нет), кладёт скрипты в /usr/local/bin, создаёт /var/backups/anticore (только root),
# вешает cron на 03:30 каждую ночь, настраивает ротацию лога и сразу делает первую копию.
# Повторный запуск безопасен (обновит скрипты, копии не тронет).
set -euo pipefail
[ "$(id -u)" = "0" ] || { echo "Запусти через sudo: sudo bash $0" >&2; exit 1; }
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$HERE/backup-db.sh" ] || { echo "Рядом нет backup-db.sh" >&2; exit 1; }

command -v pg_dump >/dev/null || { apt-get update -y && apt-get install -y postgresql-client; }

install -m 0755 "$HERE/backup-db.sh" /usr/local/bin/anticore-backup
[ ! -f "$HERE/restore-check.sh" ] || install -m 0755 "$HERE/restore-check.sh" /usr/local/bin/anticore-restore-check
install -d -m 0700 /var/backups/anticore

cat > /etc/cron.d/anticore-backup <<'CRON'
# Ежедневный бэкап БД anticore (см. deploy/README.md, «Бэкап базы»)
30 3 * * * root /usr/local/bin/anticore-backup >> /var/log/anticore-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/anticore-backup

cat > /etc/logrotate.d/anticore-backup <<'LR'
/var/log/anticore-backup.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
}
LR

echo "== Первая копия"
/usr/local/bin/anticore-backup
echo
echo "Готово. Расписание: каждую ночь в 03:30 (время сервера: $(date +%Z))."
echo "  Копии:  ls -lh /var/backups/anticore"
echo "  Лог:    tail /var/log/anticore-backup.log"
echo "  Проверка восстановления (раз в месяц): sudo anticore-restore-check"
