# Testing known flakes / conditional skips

Tracked for release gates. Do not expand this list without a root-cause note.

## Conditional skips (fixture-gated, not failures)

| Spec | Test | Why skipped | Scope |
|---|---|---|---|
| `backend/src/import-migration/raw-appointment-import.spec.ts` | `parses sample raw export workbook` | `it.skip` when the local sample workbook file is absent (`sampleExists` false). Pre-existing before Phase 3 lottery; not a lottery/tip/expense regression. | Out of Phase 3.5 scope — needs sample fixture checked into fixtures or CI artifact. |

## Fixed in Phase 3.5 (commit D)

| Spec | Symptom | Fix |
|---|---|---|
| `backend/src/appointments/appointments.settle-lock.pg.spec.ts` | Intermittent `Unique constraint failed on (phone)` when re-seeding | Generate a fresh 11-digit IR phone set **per seed invocation** (`process.pid` + time + seq + random). FOR UPDATE assertions unchanged. |

## Notes

- PG-backed suites (`*.pg.spec.ts`) use `describe.skip` when `DATABASE_URL` is not loopback; on local release-gate runs with localhost Postgres they execute and must pass.
