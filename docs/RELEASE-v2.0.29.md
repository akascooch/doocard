# Release v2.0.29

## Production baseline (verified 2026-10-08)

| Field | Value |
|---|---|
| Status | **LIVE** — cycle closed |
| Branch | `release/v2.0.29` |
| Production tag | `v2.0.29-prod` on `c038abb2847985267546655c0464ebc7634f879d` |
| Feature commit | `44d705f9c1918b93a366ff26617dba4f715abaa3` |
| Ready tag | `v2.0.29-ready` (same commit as the production tag) |
| Frontend BUILD_ID | `O0Q0yo8v1ytFqAS_r-6uz` (source `.next/BUILD_ID` == standalone) |
| Previous BUILD_ID | `f9kxnxD05K_i1GXS5ZXe1` |
| Database | 83 migrations applied on `doocard`. Latest: `20261008160000_booking_group_and_settlement_audit` |
| Backup | `/var/backup/doocard_pre_v2.0.29.sql` (51,101,756 bytes, dump complete) |
| Rollback copies | `/var/backups/doocard/dist-pre-v2.0.29`, `/var/backups/doocard/standalone-pre-v2.0.29` |
| Method | Source overlay, Ubuntu `prisma generate`, `nest build`, `npm run build`, then `pm2 reload`. Production git was not pulled. No `rsync --delete`. `.env` untouched. |
| Health | `GET http://127.0.0.1:3001/api/health` 200, database up |
| Redis | `redis-server` active, `redis-cli ping` = `PONG`. No reconnect loop in the backend logs. |
| PM2 | `doocard-backend` pid 2400478; `doocard-frontend` pid 2400517. Nest started on `127.0.0.1:3001`. Next ready on `127.0.0.1:3000` in 167ms. |
| Price correction | Dry-run and `APPLY=1` both scanned 30 open appointments and updated 0 rows. |
| nginx | active. apache2 left masked/failed. |
| Residuals | Frontend image optimization still logs missing `sharp`. Push subscribe of an existing endpoint returns 409. Scanner hits on nginx are denied. Two `connect() failed (111)` lines at 20:15 and 20:20 +0330 match the backend reload window and did not continue after Ready. |

## Prior cutover 2026-10-07

| Field | Value |
|---|---|
| Branch | `release/v2.0.29` |
| Tag | `v2.0.29-released` |
| Production BUILD_ID | `f9kxnxD05K_i1GXS5ZXe1` (source and standalone) |
| Previous BUILD_ID | `WeM0efkdwaWyosRy3YUsO` |
| Cutover | 2026-10-07 15:20:45 UTC |
| Migration | `20261007143000_personal_entry_direction` applied on production `doocard` |
| Method | Source staging on Ubuntu, `npm ci`, serial `prisma generate`, build, then artifact swap. Production git was not pulled or checked out. |

## Shipped behavior

- Admin-only settlement amount override, with `priceOverrideReason` required when the amount changes.
- Frog header badge uses the primary theme token in both themes.
- Expense charts exclude payroll markers only. `EXCEL_IMPORT:PAYS` stays unless a row itself carries a payroll marker. Uncategorized rows are `بدون دسته‌بندی`.
- Manual tip void is ADMIN-only, reason-required, and blocked after payroll settlement.
- Personal ledger directions `INCOME` and `EXPENSE`, default `EXPENSE`, scoped to the authenticated user.
- Canonical logo filenames under `frontend/public/logo/doocard-*`. Favicon replaced. Home and auth marks enlarged.

## Verification limits

Live settlement, tip-void, petty-cash, and browser theme checks were not executed against production data. Health, binds, logo bytes, and the October expense SQL split were checked after cutover.

## Runtime version strings

This closeout sets both `package.json` files to `2.0.29`. The production tree was left untouched, so the live `package.json` copies and the already-built frontend still report the previous package versions until the next overlay.
