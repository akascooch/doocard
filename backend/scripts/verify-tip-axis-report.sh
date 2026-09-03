#!/bin/bash
set -e
cd /var/www/doocard/backend
pm2 save || true

node <<'NODE'
require('dotenv').config({ path: '.env' });
const jwt = require('jsonwebtoken');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

function req(path) {
  return new Promise(async (resolve, reject) => {
    const admin = await p.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true, role: true, phone: true } });
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET missing');
    const token = jwt.sign({ sub: admin.id, role: admin.role, phone: admin.phone || 'x' }, secret, { expiresIn: '10m' });
    const opts = {
      hostname: '127.0.0.1',
      port: 3001,
      path,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    };
    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode, body: d.slice(0, 500) }); }
      });
    });
    r.on('error', reject);
    r.end();
  });
}

(async () => {
  const paid = await req('/api/admin/tips/report?from=1405/04/20&to=1405/04/20&dateAxis=PAID_AT&origin=ALL&pageSize=100');
  const sched = await req('/api/admin/tips/report?from=1405/04/20&to=1405/04/20&dateAxis=SCHEDULED_AT&origin=ALL&pageSize=100');
  const schedApt = await req('/api/admin/tips/report?from=1405/04/20&to=1405/04/20&dateAxis=SCHEDULED_AT&origin=APPOINTMENT&pageSize=100');
  const summarize = (label, res) => {
    const b = res.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    const apt = items.filter((i) => i.origin === 'APPOINTMENT');
    const man = items.filter((i) => i.origin === 'MANUAL');
    const diff = items.filter((i) => i.isSettledOnDifferentDay);
    console.log(JSON.stringify({
      label,
      status: res.status,
      dateAxis: b.dateAxis,
      total: b.total,
      summaryCount: b.summary && b.summary.sourceTransactionCount,
      settledOnDifferentDayCount: b.summary && b.summary.settledOnDifferentDayCount,
      appointmentCount: apt.length,
      manualCount: man.length,
      differentDayIds: diff.map((i) => i.sourceId),
      appointmentIds: apt.map((i) => i.sourceId).sort((a,b)=>a-b),
    }, null, 2));
  };
  summarize('PAID_AT', paid);
  summarize('SCHEDULED_AT_ALL', sched);
  summarize('SCHEDULED_AT_APPOINTMENT', schedApt);

  const sample = await p.transaction.findFirst({
    where: { sourceType: 'TIP', sourceId: 75151, deletedAt: null },
    select: { id: true, description: true },
  });
  console.log('SAMPLE_DESC', JSON.stringify(sample));
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
NODE
