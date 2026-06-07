# Excel Historical Migration

Imports `Pays.xlsx` (expenses) and `1402-1405.xlsx` (appointments) into PostgreSQL via Prisma.

**Money rule:** all amounts are **Rial**. Never multiply by 10.

## Files

| File | Purpose |
|------|---------|
| `helpers.ts` | Parsers, resolvers, dedup keys |
| `run-import.ts` | Dry-run + commit importer |
| `rollback.ts` | Soft-delete batch by `batchId` |
| `reports/` | JSON dry-run / commit reports |

## Commands

From `backend/`:

```powershell
# 1) Dry-run (no writes)
npm run import:migration:dry-run

# 2) Dry-run with reference-data auto-create simulation
npx ts-node scripts/import-migration/run-import.ts --dry-run --create-missing

# 3) Commit import (creates missing categories, calendar dates, users, services)
npm run import:migration:commit

# Custom batch id
npx ts-node scripts/import-migration/run-import.ts --commit --create-missing --batch-id=prod-migration-2026-06-02

# Import only one file
npx ts-node scripts/import-migration/run-import.ts --dry-run --pays-only
npx ts-node scripts/import-migration/run-import.ts --commit --appointments-only --create-missing

# Dedup: import all rows (adds minute offset for duplicate keys)
npx ts-node scripts/import-migration/run-import.ts --commit --create-missing --dedup=import-all

# Skip INCOME transactions for appointments
npx ts-node scripts/import-migration/run-import.ts --commit --create-missing --skip-income-tx

# Rollback preview
npx ts-node scripts/import-migration/rollback.ts --batch-id=<batchId> --dry-run

# Rollback confirm (soft-delete + reverse bank balance)
npx ts-node scripts/import-migration/rollback.ts --batch-id=<batchId> --confirm
```

## Environment

```env
DATABASE_URL=postgresql://...
PAYS_XLSX_PATH=C:/path/to/Pays.xlsx
APPT_XLSX_PATH=C:/path/to/1402-1405.xlsx
```

## Pre-flight

1. `npm run prisma:migrate:deploy`
2. `npm run prisma:seed` (calendar_dates) — or use `--create-missing`
3. Admin user + default `BankAccount` must exist
4. Review dry-run JSON in `reports/`

## Rollback

Rollback soft-deletes appointments/transactions tagged with `batchId` in `meta` / `notes`. Always dry-run rollback first.
