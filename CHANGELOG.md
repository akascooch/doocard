# Changelog

## 2.0.29 — 2026-10-07

Production overlay is live. Build ID `f9kxnxD05K_i1GXS5ZXe1`. Migration `20261007143000_personal_entry_direction` is applied. The production git tree was not updated.

- Settlement amount override is ADMIN-only. A changed amount requires `priceOverrideReason` (400 when it is missing). Any other role that submits a different amount receives 403. An unchanged total still settles.
- The frog header badge uses the theme primary token (`--primary: 350 96% 43%`) in light and dark themes.
- Operating-expense charts keep real operating costs, including operating cheques. Staff withdrawals, payroll, salary settlement, and salary cheques are excluded. Import sources such as `EXCEL_IMPORT:PAYS` are not dropped as a whole. Rows with no category are labeled `بدون دسته‌بندی` and stay separate from the real category `سایر`.
- Manual tips are voided, not hard-deleted, via `POST /admin/tips/:id/void`. ADMIN only, MANUAL origin only, reason required. A tip already tied to payroll settlement is rejected.
- Personal petty cash is a per-user ledger (`req.user.id` only) with direction `INCOME` or `EXPENSE` (default `EXPENSE`). Balance is income minus expense. It is not part of salon accounting.
- In-repo prompt source is `docs/prompts/MASTER.md`. Generated scratch, Next backup builds, and the hashed logo drop folder are gitignored.
- Canonical transparent mark is `doocard-mark-1024.png`, with generated icons and a replaced favicon. Old `/logo` filenames were not overwritten. Home logo is about 192px and 256px from the `sm` breakpoint. Login and register use a centered mark of about 112px and 144px.
