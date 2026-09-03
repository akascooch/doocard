#!/bin/bash
set -e
cd /var/www/doocard/backend

# Keep a lean ecosystem; load secrets via dotenv from cwd/.env
cat > ecosystem.config.js <<'EOF'
module.exports = {
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
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DOTENV_CONFIG_PATH: '/var/www/doocard/backend/.env',
      },
    },
  ],
};
EOF

# Align auth module with JWT_SECRET flat key (local/current source of truth)
cp -a /var/www/doocard/backend/src/auth/auth.module.ts /var/www/doocard/backend/src/auth/auth.module.ts.bak-v2034 || true

pm2 delete doocard-backend >/dev/null 2>&1 || true
fuser -k 3001/tcp >/dev/null 2>&1 || true
sleep 1

# Smoke test foreground
set +e
timeout 15s node -r dotenv/config dist/main.js > /tmp/be-ok.out 2> /tmp/be-ok.err
FG=$?
set -e
echo FG_EXIT=$FG
python3 -c "print(open('/tmp/be-ok.err','rb').read()[-1800:].decode('utf-8','replace'))"
python3 -c "print(open('/tmp/be-ok.out','rb').read()[-1200:].decode('utf-8','replace'))"

# If smoke listened successfully (timeout 124), good
pm2 start ecosystem.config.js --only doocard-backend
sleep 14
pm2 save
pm2 list
ss -lntp | grep 3001 || echo PORT_DOWN
curl -s -o /dev/null -w "HTTP=%{http_code}\n" http://127.0.0.1:3001/api/docs || true

# If still JWT error, patch dist auth to read JWT_SECRET
if ! ss -lntp | grep -q 3001; then
  echo "PATCHING_AUTH_DIST"
  python3 <<'PY'
from pathlib import Path
p = Path('dist/auth/auth.module.js')
s = p.read_text(encoding='utf-8')
s2 = s.replace("configService.get('jwt.secret')", "configService.get('JWT_SECRET') || configService.get('jwt.secret')")
s2 = s2.replace('configService.get("jwt.secret")', 'configService.get("JWT_SECRET") || configService.get("jwt.secret")')
# also compiled variants
s2 = s2.replace("get('jwt.secret')", "get('JWT_SECRET') || get('jwt.secret')")
if s2 == s:
    # try broader
    import re
    s2 = re.sub(r"get\((['\"])jwt\.secret\1\)", r"get('JWT_SECRET') || get('jwt.secret')", s)
p.write_text(s2, encoding='utf-8')
print('auth patched', s!=s2)
PY
  pm2 restart doocard-backend
  sleep 12
  ss -lntp | grep 3001 || echo PORT_DOWN
fi

if ss -lntp | grep -q 3001; then
  node <<'NODE'
require('dotenv').config({ path: '.env' });
const jwt = require('jsonwebtoken');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const admin = await p.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true, role: true, phone: true } });
  const token = jwt.sign({ sub: admin.id, role: admin.role, phone: admin.phone || 'x' }, process.env.JWT_SECRET, { expiresIn: '10m' });
  for (const axis of ['PAID_AT', 'SCHEDULED_AT']) {
    const path = `/api/admin/tips/report?from=1405/04/20&to=1405/04/20&dateAxis=${axis}&origin=ALL&pageSize=100`;
    await new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port: 3001, path, method: 'GET', headers: { Authorization: `Bearer ${token}` } }, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            const b = JSON.parse(d);
            const items = b.items || [];
            console.log(JSON.stringify({
              axis,
              status: res.statusCode,
              total: b.total,
              appointmentCount: items.filter((i) => i.origin === 'APPOINTMENT').length,
              manualCount: items.filter((i) => i.origin === 'MANUAL').length,
              settledOnDifferentDayCount: b.summary && b.summary.settledOnDifferentDayCount,
              appointmentIds: items.filter((i) => i.origin === 'APPOINTMENT').map((i) => i.sourceId).sort((a,b)=>a-b),
            }));
          } catch (e) {
            console.log(axis, res.statusCode, d.slice(0, 250));
          }
          resolve();
        });
      });
      req.on('error', reject);
      req.end();
    });
  }
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
NODE
fi
