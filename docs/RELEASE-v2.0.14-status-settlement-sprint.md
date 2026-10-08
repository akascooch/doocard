# Release note: v2.0.14 status and settlement sprint

Status: CLOSED. Deployed and stable on 2026-10-06.

This note is local documentation. It was not committed or pushed by the closeout step.

## Identity

| Item | Value |
|---|---|
| Tag | `v2.0.14-status-settlement-sprint` |
| Git SHA | `aff086185ecd1e260e20f00265330ec0cedf5cd9` |
| Branch | `release/v2.0.7` (not pushed) |
| Frontend BUILD_ID | `7o6Dtmg2X615r9xGX5Mtz` |
| Previous BUILD_ID | `ytyQe_k7jkuz8iEQ7P1gX` |
| Deployed | 2026-10-06 |
| Production git | dirty `main` `0537c56a2a5544bd237ffd62305116cb6fcbd807` (unchanged) |

## Retained rollback copies

Keep at least 7 days:

- `/var/www/doocard/frontend/.next/standalone.predeploy-20261006T142852Z`
- `/var/www/doocard/backups/pre-v2.0.14-backend-20261006T140821Z`
- `/var/www/doocard/backups/pre-v2.0.14-frontend-20261006T140821Z`

Closeout removed `/tmp/doocard-frontend-v2.0.14-node20.tar.gz`, `/tmp/doocard-backend-v2.0.14-dist.tar.gz`, and the empty `/var/www/doocard/.release-staging/` directory.

## v2.0.29 local release (appended; v2.0.14 record above is unchanged)

| Item | Value |
|---|---|
| Branch | `release/v2.0.29` |
| Feature commit | `44d705f9c1918b93a366ff26617dba4f715abaa3` |
| Ready tag | `v2.0.29-ready` |
| Prior HEAD | `2f993450e1a916db16aa1be4cf2dfda294ddfb2e` |
| Migration | `20261008160000_booking_group_and_settlement_audit` (additive columns only) |

Phase 3 local verification, before this commit, passed: backend `tsc --noEmit`, frontend `tsc --noEmit`, Jest 12 suites / 90 tests, frontend date tests 11, `nest build`, `next build` 66/66, Prisma 83 migrations up to date on local database `Doocard`. HTTP checks B1–B3 and B6 passed. B4 linked cheque stayed one `CHEQUE_LEAF` document; an unlinked MANUAL expense of 999000009 rial stayed and a second `CHEQUE_LEAF` of the same amount was created. That edge was not changed. B5 kept `CHEQUE_DUE_SMS_ENABLED` off; issued `STAFF_SALARY` and `GUARANTEE` leaves are still included in the plan. Customer UI booked two simultaneous services with two barbers, prices 10000000 and 30000000 rial, one shared `bookingGroupId`. A single-service booking from the same UI had `bookingGroupId` null. Settlement button showed disabled text `در حال تسویه...`. Barber history showed only own/shared appointments and hid foreign private notes. The legacy staff form still saves several services for one barber as one appointment. Toast overlap at the bottom of the settle dialog was recorded and not fixed.

Owner decisions still open: reminder inclusion for salary and guarantee cheques, and whether clearing an unlinked manual expense should be blocked. The legacy one-appointment form is a later alignment, not part of this release.
