#!/bin/bash
set -e
cd /var/www/doocard/backend
pm2 delete doocard-backend 2>/dev/null || true
fuser -k 3001/tcp 2>/dev/null || true
sleep 1

# Verify EntryType stubs
node -e 'require("./dist/accounting/dto/create-financial-entry.dto.js"); console.log("create_ok")'
node -e 'require("./dist/accounting/dto/update-financial-entry.dto.js"); console.log("update_ok")'

# Boot once in foreground to capture exact error
set +e
timeout 12s node -r dotenv/config dist/main.js > /tmp/be-fg.out 2> /tmp/be-fg.err
echo FG_EXIT=$?
set -e
echo "===FG_ERR==="
tail -c 4000 /tmp/be-fg.err || true
echo "===FG_OUT==="
tail -c 2500 /tmp/be-fg.out || true

# Start PM2 in fork mode (not cluster)
pm2 start dist/main.js \
  --name doocard-backend \
  --cwd /var/www/doocard/backend \
  --node-args="-r dotenv/config" \
  -i 0 \
  --interpreter node
sleep 10
pm2 list
ss -lntp | grep 3001 || echo PORT_DOWN
curl -s -o /dev/null -w "HTTP=%{http_code}\n" http://127.0.0.1:3001/api/docs || true
ERR=$(ls -t /root/.pm2/logs/doocard-backend-error*.log | head -1)
echo ERRFILE=$ERR
tail -c 2500 "$ERR" || true
OUT=$(ls -t /root/.pm2/logs/doocard-backend-out*.log | head -1)
echo OUTFILE=$OUT
tail -c 2000 "$OUT" || true
