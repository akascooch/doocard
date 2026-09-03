#!/bin/bash
set -euo pipefail
BK=/var/backups/doocard/20260713-143733-service-tip-100pct-and-tip-module
APP=/var/www/doocard/backend

echo "=== STOP BACKEND ==="
pm2 delete doocard-backend >/dev/null 2>&1 || true
fuser -k 3001/tcp >/dev/null 2>&1 || true
sleep 1

echo "=== BACKUP CURRENT BROKEN DIST ==="
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "/var/backups/doocard/${STAMP}-pre-restore-dist"
tar -czf "/var/backups/doocard/${STAMP}-pre-restore-dist/backend-dist-broken.tgz" -C "$APP" dist || true

echo "=== RESTORE DIST FROM TIP-MODULE BACKUP ==="
rm -rf "$APP/dist"
mkdir -p "$APP/dist"
tar -xzf "$BK/built/backend-dist.tgz" -C "$APP/dist"
# tarball may contain nested dist/ or flat files
if [ -d "$APP/dist/dist" ]; then
  mv "$APP/dist/dist"/* "$APP/dist/" 2>/dev/null || true
  rmdir "$APP/dist/dist" 2>/dev/null || true
fi
if [ -f "$APP/dist/main.js" ]; then
  echo DIST_MAIN=ok
elif [ -f "$APP/dist/src/main.js" ]; then
  echo "Nested src layout detected; flattening"
  # keep as-is if that's how backup was
  ls "$APP/dist" | head
else
  # maybe archived with top-level files from inside dist
  ls -la "$APP/dist" | head -30
fi

# Detect main path
MAIN=""
if [ -f "$APP/dist/main.js" ]; then MAIN="$APP/dist/main.js"; fi
if [ -z "$MAIN" ] && [ -f "$APP/dist/src/main.js" ]; then MAIN="$APP/dist/src/main.js"; fi
echo MAIN=$MAIN
test -n "$MAIN"

# Restore lean ecosystem matching prior successful tip-module boot
# Prior dump had empty node_args; main itself loads env via ConfigModule/.env
cat > "$APP/ecosystem.config.js" <<EOF
module.exports = {
  apps: [
    {
      name: 'doocard-backend',
      cwd: '$APP',
      script: '${MAIN#$APP/}',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
EOF

echo "=== START RESTORED BACKEND ==="
cd "$APP"
pm2 start ecosystem.config.js --only doocard-backend
sleep 14
pm2 list
ss -lntp | grep 3001 || echo PORT_DOWN
curl -s -o /dev/null -w "HTTP=%{http_code}\n" http://127.0.0.1:3001/api/docs || true
OUT=$(ls -t /root/.pm2/logs/doocard-backend-out*.log | head -1)
python3 -c "print(open('$OUT','rb').read()[-1200:].decode('utf-8','replace'))"
ERR=$(ls -t /root/.pm2/logs/doocard-backend-error*.log | head -1)
python3 -c "b=open('$ERR','rb').read()[-1500:].decode('utf-8','replace'); print(b if 'ERROR' in b or 'Error' in b else 'no_recent_error')"

if ss -lntp | grep -q 3001; then
  pm2 save
  echo RESTORE_OK
else
  echo RESTORE_FAILED
  exit 1
fi
