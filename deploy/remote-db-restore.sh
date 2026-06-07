#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/local/pgsql/bin:/usr/local/bin:$PATH
PG_PASS='Lord7know$'
BACKUP=/var/www/doocard/current/database/doocard-2026-06-02-1732.full.backup
systemctl start postgresql
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '${PG_PASS}';" || true
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='doocard'" | grep -q 1 || sudo -u postgres createdb doocard
export PGPASSWORD="${PG_PASS}"
/usr/local/pgsql/bin/pg_restore -h 127.0.0.1 -U postgres -d doocard --clean --if-exists --no-owner --no-acl "$BACKUP" 2>&1 | tee /root/pg_restore.log | tail -30
sudo -u postgres psql -d doocard -tAc 'SELECT COUNT(*) FROM appointments WHERE "deletedAt" IS NULL;'
echo DB_RESTORE_DONE
