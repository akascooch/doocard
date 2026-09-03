#!/bin/bash
set -e
cd /var/www/doocard/backend

pm2 delete doocard-backend >/dev/null 2>&1 || true
fuser -k 3001/tcp >/dev/null 2>&1 || true
sleep 1

# Build ecosystem that injects .env into PM2 env (JWT etc.)
node <<'NODE'
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join('/var/www/doocard/backend', '.env');
const parsed = dotenv.parse(fs.readFileSync(envPath));
const env = {
  ...parsed,
  NODE_ENV: 'production',
  PORT: '3001',
  DOTENV_CONFIG_PATH: envPath,
};
const cfg = {
  apps: [
    {
      name: 'doocard-backend',
      cwd: '/var/www/doocard/backend',
      script: 'dist/main.js',
      interpreter: 'node',
      node_args: '-r dotenv/config',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env,
    },
  ],
};
fs.writeFileSync('/var/www/doocard/backend/ecosystem.config.js', 'module.exports = ' + JSON.stringify(cfg, null, 2) + ';\n');
console.log('ECOSYSTEM_WRITTEN keys=', Object.keys(env).filter(k => /JWT|PORT|DATABASE|NODE/.test(k)).join(','));
NODE

pm2 start /var/www/doocard/backend/ecosystem.config.js --only doocard-backend
sleep 15
pm2 list
ss -lntp | grep 3001 || echo PORT_DOWN
ERR=$(ls -t /root/.pm2/logs/doocard-backend-error*.log | head -1)
echo ERRFILE=$ERR
python3 -c "print(open('$ERR','rb').read()[-2000:].decode('utf-8','replace'))"
OUT=$(ls -t /root/.pm2/logs/doocard-backend-out*.log | head -1)
echo OUTFILE=$OUT
python3 -c "print(open('$OUT','rb').read()[-1500:].decode('utf-8','replace'))"

if ss -lntp | grep -q 3001; then
  pm2 save
  bash /tmp/verify-tip-axis-report.sh || true
fi
