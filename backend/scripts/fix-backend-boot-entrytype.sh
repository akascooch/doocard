#!/bin/bash
set -e
cd /var/www/doocard/backend

python3 <<'PY'
from pathlib import Path
root = Path("dist")
patched = 0
for p in root.rglob("*.js"):
    s = p.read_text(encoding="utf-8", errors="ignore")
    if 'client_1.EntryType' not in s:
        continue
    if 'client_1.EntryType = {' in s:
        continue
    needle = 'const client_1 = require("@prisma/client");'
    if needle not in s:
        continue
    s2 = s.replace(
        needle,
        needle + '\nif (!client_1.EntryType) client_1.EntryType = { INCOME: "INCOME", EXPENSE: "EXPENSE" };',
        1,
    )
    if s2 != s:
        p.write_text(s2, encoding="utf-8")
        patched += 1
        print("PATCHED", p)
print("TOTAL_PATCHED", patched)
PY

pkill -f "node -r dotenv/config dist/main.js" 2>/dev/null || true
pm2 delete doocard-backend 2>/dev/null || true
fuser -k 3001/tcp 2>/dev/null || true
sleep 1

pm2 start dist/main.js \
  --name doocard-backend \
  --cwd /var/www/doocard/backend \
  --node-args="-r dotenv/config" \
  -i 1

sleep 10
pm2 list
ss -lntp | grep 3001 || echo PORT_DOWN
curl -s -o /dev/null -w "HTTP=%{http_code}\n" http://127.0.0.1:3001/api/docs || true
ERR=$(ls -t /root/.pm2/logs/doocard-backend-error*.log 2>/dev/null | head -1 || true)
if [ -n "$ERR" ]; then
  echo "ERRFILE=$ERR"
  tail -c 2000 "$ERR" || true
fi
OUT=$(ls -t /root/.pm2/logs/doocard-backend-out*.log 2>/dev/null | head -1 || true)
if [ -n "$OUT" ]; then
  echo "OUTFILE=$OUT"
  tail -c 1500 "$OUT" || true
fi
