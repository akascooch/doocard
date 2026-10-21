# Cheque due reminder (SMS) — ops runbook

Code: `backend/src/sms/cheque-due-sms-reminder.service.ts`, preview controller
`backend/src/sms/cheque-due-reminder-admin.controller.ts`. Release `v2.0.31-cheque-admin-cron`.

## What runs

| Item | Value |
|------|-------|
| Cron | `0 8 * * *`, timezone `Asia/Tehran` (04:30 UTC; Iran has no DST) |
| Offsets | `[3, 2, 1, 0]` days before due date |
| Stage per offset | 3 → `t_minus_3` (T-3), 2 → `t_minus_2` (T-2), 1 → `t_minus_1` (T-1), 0 → `t_zero` (T-0, "امروز") |
| Target due day | Tehran today + offset, window `[YYYY-MM-DDT00:00+03:30, 23:59:59.999+03:30]` |
| Cheques matched | `cheque_leaves.status = ISSUED`, `deletedAt IS NULL`, chequebook not deleted |
| Kill-switch | `CHEQUE_DUE_SMS_ENABLED` in `backend/.env`; sends only when exactly `true` |
| Also required | `SMS_ENABLED=true` and SMS policy `cheque.dueReminder` enabled |
| Event key | `sms_events."eventKey" = 'cheque.dueReminder'` |

Stage labels are relative to the run day: a cheque due 2026-10-22 is T-1 in a preview taken on
2026-10-21 and T-0 in the 2026-10-22 08:00 run.

## Recipients

Every user with `role = ADMIN` **and** (no `employees` row **or** `employees."isActive" = true`),
whose phone normalises to `^09[0-9]{9}$`. One SMS per unique phone per cheque. `users` has no
active flag of its own. No hardcoded numbers, no CC; `CHEQUE_DUE_SMS_TEST_PHONES`,
`CHEQUE_DUE_SMS_USE_ROLE_RECIPIENTS` and `CHEQUE_DUE_SMS_INCLUDE_ACCOUNTANT` are removed and ignored.
If no admin qualifies, the run logs `{"event":"cheque_due_reminder.aborted",...}` and sends nothing.

## Idempotency

`dedupeKey = cheque:reminder:{leafId}:{stage}:{jalaliDue}:{last4}.{sha256(phone)[0:12]}` (unique).
Before sending, one query reads existing statuses: `SENT` or `PENDING` → skipped; `FAILED` → retried.
`SmsOutboundService.sendIfAllowed` writes a `PENDING` row first, sends, then marks `SENT`/`FAILED`,
so a crash mid-send cannot cause a second send. `sms_events.to` stores `***last4` only.

## No catch-up for missed runs

Each run handles only the offset that matches *today*. If the 08:00 run is missed (backend down,
flag off, SMS provider down), that day's stage is **not** sent later, and cheques whose due date
has passed are never backfilled. The next stage is sent on the next day's 08:00 run.

## Disable immediately

```bash
cd /var/www/doocard/backend
cp -a .env /var/www/doocard_backups/env.before-cheque-disable.$(date -u +%Y%m%d_%H%M%S)
sed -i -E 's/^CHEQUE_DUE_SMS_ENABLED=.*/CHEQUE_DUE_SMS_ENABLED=false/' .env
grep -c '^CHEQUE_DUE_SMS_ENABLED=false$' .env   # expect 1
pm2 reload doocard-backend
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/api/health   # expect 200
```

Full release rollback: `bash /var/www/doocard_backups/cheque_admin_cron_20261021_093908/rollback.sh`.

## Post-run verification (run once, after 08:00 Tehran)

All commands run on the server as root. None of them send SMS or print secrets or full phones.

1. Backend log (last 200 lines):

```bash
pm2 logs doocard-backend --lines 200 --nostream 2>&1 \
  | grep -E 'cheque_due_reminder|Cheque due reminders|Cheque due reminder cron failed|Cheque in-app notice' \
  | sed -E 's/[0-9]{9,}/<num>/g'
```

Expected one line `Cheque due reminders dryRun=false recipients=N planned=P sent=S alreadySent=0 skipped=0`.

2. Preview (one call; uses the compiled service directly, sending is stubbed to throw):

```bash
cd /var/www/doocard/backend && node <<'JS'
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { ChequeDueSmsReminderService } = require('./dist/sms/cheque-due-sms-reminder.service');
const prisma = new PrismaClient();
const svc = new ChequeDueSmsReminderService(
  { get: (k) => process.env[k] }, prisma,
  { sendIfAllowed: () => { throw new Error('send blocked in preview'); } },
  { renderByKey: async () => null });
svc.previewPlan().then((p) => console.log(JSON.stringify({
  enabled: p.enabled, today: p.today, schedule: p.schedule,
  recipients: p.recipients.map((r) => [r.userId, r.phone]),
  offsets: p.offsets.map((o) => [o.offsetDays, o.stage, o.dueDate, o.leafIds]),
  count: p.count, sent: p.sentCount, pending: p.pendingCount,
  items: p.items.map((i) => [i.leafId, i.stage, i.userId, i.dispatch, i.lastStatus]),
}, null, 1))).finally(() => prisma.$disconnect());
JS
```

An ADMIN can call the same thing over HTTP with their own session token:
`GET /api/admin/sms/cheques/due-reminder/preview` (read-only; there is no send endpoint).

3. One query on `sms_events` for today's 08:00–08:15 Tehran window, grouped by status and stage:

```bash
cd /var/www/doocard/backend && node <<'JS'
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
const from = new Date(`${today}T08:00:00+03:30`);
const to = new Date(`${today}T08:15:00+03:30`);
prisma.smsEvent.findMany({
  where: { eventKey: 'cheque.dueReminder', createdAt: { gte: from, lt: to } },
  select: { dedupeKey: true, status: true },
}).then((rows) => {
  const by = {};
  for (const r of rows) {
    const [, , leaf, stage] = String(r.dedupeKey).split(':');
    const k = `${r.status} leaf=${leaf} stage=${stage}`;
    by[k] = (by[k] || 0) + 1;
  }
  console.log(JSON.stringify({ today, from: from.toISOString(), to: to.toISOString(), total: rows.length, by }, null, 1));
}).finally(() => prisma.$disconnect());
JS
```

Equivalent SQL (timestamps are stored as UTC in `timestamp(3)`), e.g. for 2026-10-22:

```sql
SELECT status, count(*) FROM sms_events
WHERE "eventKey" = 'cheque.dueReminder'
  AND "createdAt" >= '2026-10-22 04:30:00' AND "createdAt" < '2026-10-22 04:45:00'
GROUP BY status;
```

Expected: `SENT` count = (matched cheques) × (active admin recipients); no `FAILED`/`PENDING`.
