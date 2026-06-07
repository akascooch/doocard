# Production – Arash historical import

**⚠️ LIVE server. No git, no migrations, no schema changes.**

## Prerequisites

1. **Upload to server** (e.g. SCP or SFTP):
   - `arash-data.xlsx` → `/var/www/doocard/backend/arash-data.xlsx`
   - Updated scripts: `scripts/arash-import-phase2-run.ts`, `scripts/count-appointments.js`, `scripts/production-arash-import-runbook.sh`

2. **SSH**
   ```bash
   plink -P 3031 root@185.255.88.158
   # or: ssh -p 3031 root@185.255.88.158
   ```
   Password: `AMFZg36oL87h4oaGj0`

---

## Phase 0 – Pre-flight (manual)

```bash
cd /var/www/doocard/backend
node -v
pm2 list
node scripts/count-appointments.js
```

**Record:** Total appointments, Arash employeeId, Appointments for Arash.

---

## Phase 1 – Full DB backup

```bash
cd /var/www/doocard/backend
set -a && [ -f .env ] && source .env && set +a
BACKUP_FILE="/tmp/doocard_pre_arash_import_$(date +%Y%m%d_%H%M%S).dump"
pg_dump "$DATABASE_URL" -F c -Z 6 -f "$BACKUP_FILE"
ls -lh "$BACKUP_FILE"
```

If `pg_dump` is not in PATH or fails, run manually with your DB credentials:
```bash
pg_dump -U doocard_user -d MOVA -h LOCALHOST_OR_SOCKET -p PORT -F c -Z 6 -f /tmp/doocard_pre_arash_import_YYYYMMDD_HHMMSS.dump
```

**Do not continue if backup fails.**

---

## Phase 2 – Run import

```bash
cd /var/www/doocard/backend
export ARASH_EXCEL_PATH="/var/www/doocard/backend/arash-data.xlsx"
npx ts-node scripts/arash-import-phase2-run.ts
```

**Record:** Inserted, Skipped, Total appointments for employee, Revenue sum. First 2 / Last 2 rows from console.

---

## Phase 3 – Build

```bash
cd /var/www/doocard/backend && npm run build
cd /var/www/doocard/frontend && npm run build
```

Confirm no build errors.

---

## Phase 4 – PM2 restart

```bash
pm2 reload doocard-backend --update-env
pm2 restart doocard-frontend
pm2 list
```

Both must show **online**.

---

## Phase 5 – Verification

```bash
cd /var/www/doocard/backend
node scripts/count-appointments.js
pm2 logs doocard-backend --lines 50
```

Verify:
- Appointments for Arash increased by ~1218
- Arash ARASH_IMPORT count = 1218
- No Prisma/transaction errors in logs

---

## One-command runbook (after uploads)

```bash
cd /var/www/doocard/backend
chmod +x scripts/production-arash-import-runbook.sh
bash scripts/production-arash-import-runbook.sh
```

---

## Required output format

1. **Pre-import:** Total appointments, Arash employeeId, Appointments for Arash  
2. **Backup:** File path and size  
3. **Import:** Inserted, Skipped, date range, revenue, first 2 / last 2 rows  
4. **Build:** OK or error  
5. **PM2:** doocard-backend online, doocard-frontend online  
6. **Post-import:** Appointments for Arash, ARASH_IMPORT count, revenue
