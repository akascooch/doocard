# Release archive — 2026-10-29 (Phase 1–5)

**Production BUILD_ID:** `4dXMrGVG_5bVwxGQxevT-`  
**Local branch base:** `release/v2.0.29` @ `2292eb3` + this working-tree closeout  
**Method:** Overlay deploy (no git-pull on production `main`)

## Included evidence

| File | Phase |
|------|-------|
| `REPORT_phase1_discovery_doocard.md` | Discovery |
| `REPORT_phase2_changes.md` | Implementation (packages/finance/source/debt) |
| `REPORT_phase3_qa_verification.md` | Local QA matrix |
| `REPORT_phase4_deployment_doocard.md` | Production deploy + migrate |
| `REPORT_phase5_verification_signoff.md` | Live Ashkan + cheque filter sign-off |

## Production-verified fixes in this closeout

1. **Ashkan online booking:** employee id `3` — public slots empty for Tehran D+0..D+2; desk bypass requires ADMIN/EMPLOYEE **and** `staffAccess=true`.
2. **Cheque leaf due filter:** `dueFrom` / `dueTo` on accounting leaves endpoints; inverted/invalid → 400.
3. **Phase-2 packages/finance overlay:** `createdSource`, multi-service packages, loyalty points formula, product sales chart, customer milestone UI — migrated on prod (`20261029160000_…`, 85 migrations total).
