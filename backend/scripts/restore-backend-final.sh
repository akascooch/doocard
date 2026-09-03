#!/bin/bash
set -e
cd /var/www/doocard/backend

# Ensure app.module has AdminModule
grep -q AdminModule dist/app.module.js

pm2 delete doocard-backend >/dev/null 2>&1 || true
fuser -k 3001/tcp >/dev/null 2>&1 || true
sleep 1

# Persist start config with dotenv
cat > /var/www/doocard/backend/ecosystem.config.js <<'EOF'
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
      },
    },
  ],
};
EOF

pm2 start ecosystem.config.js --only doocard-backend
sleep 12
pm2 save
pm2 list
ss -lntp | grep 3001 || echo PORT_DOWN
curl -s -o /dev/null -w "HTTP_DOCS=%{http_code}\n" http://127.0.0.1:3001/api/docs || true

# verify tips route mapped
grep -n "Mapped {/api/admin/tips" /root/.pm2/logs/doocard-backend-out-*.log 2>/dev/null | tail -10 || true
grep -n "Mapped {/api/admin/tips" /root/.pm2/logs/doocard-backend-out.log 2>/dev/null | tail -5 || true

node <<'NODE'
require('dotenv').config({ path: '.env' });
const jwt = require('jsonwebtoken');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const admin = await p.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true, role: true, phone: true } });
  const token = jwt.sign({ sub: admin.id, role: admin.role, phone: admin.phone || 'x' }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const path = '/api/admin/tips/report?from=1405/04/20&to=1405/04/20&dateAxis=SCHEDULED_AT&origin=ALL&pageSize=100';
  await new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: 3001, path, method: 'GET', headers: { Authorization: `Bearer ${token}` } }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        console.log('STATUS', res.statusCode);
        try {
          const b = JSON.parse(d);
          const items = b.items || [];
          console.log(JSON.stringify({
            dateAxis: b.dateAxis,
            total: b.total,
            summaryCount: b.summary && b.summary.sourceTransactionCount,
            settledOnDifferentDayCount: b.summary && b.summary.settledOnDifferentDayCount,
            appointmentCount: items.filter((i) => i.origin === 'APPOINTMENT').length,
            manualCount: items.filter((i) => i.origin === 'MANUAL').length,
            appointmentIds: items.filter((i) => i.origin === 'APPOINTMENT').map((i) => i.sourceId).sort((a,b)=>a-b),
            differentDayIds: items.filter((i) => i.isSettledOnDifferentDay).map((i) => i.sourceId),
          }, null, 2));
        } catch (e) {
          console.log(d.slice(0, 400));
        }
        resolve();
      });
    });
    req.on('error', reject);
    req.end();
  });
  const paidPath = '/api/admin/tips/report?from=1405/04/20&to=1405/04/20&dateAxis=PAID_AT&origin=ALL&pageSize=100';
  await new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: 3001, path: paidPath, method: 'GET', headers: { Authorization: `Bearer ${token}` } }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try {
          const b = JSON.parse(d);
          const items = b.items || [];
          console.log('PAID_AT', JSON.stringify({
            status: res.statusCode,
            total: b.total,
            appointmentCount: items.filter((i) => i.origin === 'APPOINTMENT').length,
            manualCount: items.filter((i) => i.origin === 'MANUAL').length,
          }));
        } catch (e) {
          console.log('PAID_AT', res.statusCode, d.slice(0, 200));
        }
        resolve();
      });
    });
    req.on('error', reject);
    req.end();
  });
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
NODE
