# Release v2.0.29

## Release metadata

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
