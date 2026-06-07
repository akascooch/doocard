#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/local/pgsql/bin:/usr/local/bin:$PATH
APP=/var/www/doocard
mkdir -p "$APP/releases" /var/log/doocard
TS=$(date +%Y%m%d-%H%M%S)
REL="$APP/releases/$TS"
mkdir -p "$REL"
unzip -qo /root/doocard-prod-prep.zip -d "$REL"
ln -sfn "$REL" "$APP/current"
ls "$APP/current/backend/package.json"
ls "$APP/current/database/"*.full.backup
PG_PASS='Lord7know$'
systemctl start postgresql
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '${PG_PASS}';" || true
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='doocard'" | grep -q 1 || sudo -u postgres createdb doocard
BACKUP=$(ls "$APP/current/database/"*.full.backup | head -1)
/usr/local/pgsql/bin/pg_restore -d doocard --clean --if-exists --no-owner --no-acl "$BACKUP" 2>&1 | tee /root/pg_restore.log | tail -30
sudo -u postgres psql -d doocard -tAc 'SELECT COUNT(*) FROM appointments WHERE "deletedAt" IS NULL;'
echo EXTRACT_RESTORE_DONE
