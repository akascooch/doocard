#!/bin/bash
set -e
cd /var/www/doocard/backend
echo "=== app.module Admin ==="
grep -n AdminModule dist/app.module.js | head -20 || true
echo "=== mapped admin routes recent boot ==="
grep -n "Mapped {/api/admin" /root/.pm2/logs/doocard-backend-out.log | tail -50 || true
echo "=== controllers in admin.module ==="
grep -n Controller dist/admin/admin.module.js | head -30 || true
echo "=== does running app include AdminModule import ==="
node -e 'const m=require("./dist/app.module.js"); console.log(Object.keys(m));'
# Compare with backup if any
ls /var/backups/doocard/20260713-170509-tip-axis-descriptions/backend/ || true
