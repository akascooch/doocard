#!/bin/bash
set -e
cd /var/www/doocard/backend
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
              dateAxis: b.dateAxis,
              total: b.total,
              appointmentCount: items.filter((i) => i.origin === 'APPOINTMENT').length,
              manualCount: items.filter((i) => i.origin === 'MANUAL').length,
              settledOnDifferentDayCount: b.summary && b.summary.settledOnDifferentDayCount,
              appointmentIds: items.filter((i) => i.origin === 'APPOINTMENT').map((i) => i.sourceId).sort((a,b)=>a-b),
            }, null, 2));
          } catch (e) {
            console.log(axis, res.statusCode, String(d).slice(0, 300));
          }
          resolve();
        });
      });
      req.on('error', reject);
      req.end();
    });
  }
  const sample = await p.transaction.findFirst({
    where: { sourceType: 'TIP', sourceId: 75151, deletedAt: null },
    select: { id: true, description: true },
  });
  console.log('SAMPLE', JSON.stringify(sample));
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
NODE
pm2 save || true
pm2 list
