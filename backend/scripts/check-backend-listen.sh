#!/bin/bash
set -e
pm2 list
PID=$(pm2 jlist | python3 -c "import sys,json; apps=json.load(sys.stdin); print(next(a['pid'] for a in apps if a['name']=='doocard-backend'))")
echo PID=$PID
ss -lntp | grep "$PID" || echo NO_LISTEN_FOR_PID
ss -lntp | grep 3001 || echo PORT_3001_DOWN
tr '\0' '\n' < /proc/$PID/environ 2>/dev/null | grep -E '^(PORT|HOST|NODE_ENV)=' || true
OUT=$(ls -t /root/.pm2/logs/doocard-backend-out*.log | head -1)
ERR=$(ls -t /root/.pm2/logs/doocard-backend-error*.log | head -1)
echo OUTFILE=$OUT
python3 - <<PY
from pathlib import Path
print(Path("$OUT").read_bytes()[-2500:].decode("utf-8","replace"))
print("---ERR---")
print(Path("$ERR").read_bytes()[-2000:].decode("utf-8","replace"))
PY
# If not listening, dump nest bootstrap status via strace briefly? skip
curl -s -o /dev/null -w "HTTP=%{http_code}\n" http://127.0.0.1:3001/api/docs || true
