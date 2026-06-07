#!/usr/bin/env bash
# Doocard production deploy script — run on Ubuntu server as root or with sudo
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/doocard}"
BACKUP_FILE="${1:-}"

echo "==> Doocard deploy @ ${APP_ROOT}"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root or with sudo" >&2
  exit 1
fi

mkdir -p /var/log/doocard "${APP_ROOT}/backend/uploads"

if [[ -n "${BACKUP_FILE}" && -f "${BACKUP_FILE}" ]]; then
  echo "==> Restoring database from ${BACKUP_FILE}"
  sudo -u postgres pg_restore -d doocard --clean --if-exists --no-owner --no-acl "${BACKUP_FILE}" || true
fi

cd "${APP_ROOT}/backend"
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy
npm run build

cd "${APP_ROOT}/frontend"
npm ci --omit=dev
npm run build

if command -v pm2 >/dev/null; then
  pm2 startOrReload "${APP_ROOT}/deploy/templates/ecosystem.config.js"
  pm2 save
else
  echo "PM2 not installed — start apps manually"
fi

echo "==> Smoke test backend"
curl -sf "http://127.0.0.1:3001/api/health" | head -c 200
echo ""
echo "Deploy script finished."
