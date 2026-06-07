#!/bin/bash
# PRODUCTION – Arash historical import runbook
# Run on server: bash production-arash-import-runbook.sh
# Prereq: Upload arash-data.xlsx to /var/www/doocard/backend/arash-data.xlsx

set -e
BACKEND="/var/www/doocard/backend"
FRONTEND="/var/www/doocard/frontend"
cd "$BACKEND"

echo "=== PHASE 0 – PRE-FLIGHT ==="
node -v
pm2 list || true

# Get counts from DB (uses existing .env DATABASE_URL)
echo "Appointment counts (before import):"
node scripts/count-appointments.js

echo ""
echo "=== PHASE 1 – BACKUP ==="
BACKUP_FILE="/tmp/doocard_pre_arash_import_$(date +%Y%m%d_%H%M%S).dump"
# Load .env and run pg_dump (requires postgresql-client on server)
set -a
[ -f .env ] && source .env
set +a
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set. Create .env or export DATABASE_URL."
  exit 1
fi
pg_dump "$DATABASE_URL" -F c -Z 6 -f "$BACKUP_FILE" || {
  echo "pg_dump failed. Install postgresql-client or run manually:"
  echo "  pg_dump -U doocard_user -d MOVA -h HOST -p PORT -F c -Z 6 -f $BACKUP_FILE"
  exit 1
}
ls -lh "$BACKUP_FILE"
echo "Backup OK: $BACKUP_FILE"

echo ""
echo "=== PHASE 2 – IMPORT ==="
export ARASH_EXCEL_PATH="$BACKEND/arash-data.xlsx"
if [ ! -f "$ARASH_EXCEL_PATH" ]; then
  echo "ERROR: Upload arash-data.xlsx to $ARASH_EXCEL_PATH first"
  exit 1
fi
npx ts-node scripts/arash-import-phase2-run.ts

echo ""
echo "=== PHASE 3 – BUILD ==="
cd "$BACKEND" && npm run build
cd "$FRONTEND" && npm run build

echo ""
echo "=== PHASE 4 – PM2 RESTART ==="
pm2 reload doocard-backend --update-env
pm2 restart doocard-frontend
pm2 list

echo ""
echo "=== PHASE 5 – VERIFICATION ==="
node scripts/count-appointments.js
echo "Done. Check: pm2 logs doocard-backend --lines 50"
