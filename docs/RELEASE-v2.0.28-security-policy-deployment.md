# Release v2.0.28 — security policy deployment

## Release metadata

| Field | Value |
|---|---|
| Commit | `a18290e41a457e3dbcc4c53dab21080606c4e0c0` |
| Release tag | `v2.0.28-policy-lock` |
| Deployment window | 2026-10-07 14:14 +0330 (backup); backend online 14:16:40 +0330 |
| Runtime upgraded | `f80490ec` (`v2.0.16-ios-mobile-fix`) to `a18290e4` (`v2.0.28-policy-lock`) |
| Method | Backend dist and Prisma overlay. Production git was not pulled or checked out. |
| Frontend | Not modified and not reloaded |
| Refresh TTL | Code default `30d`. Production `.env` left at `JWT_REFRESH_EXPIRES_IN=7d` |

The live process is the overlay of commit `a18290e4`. The production git worktree remains the previous dirty `main` tree and is not the runtime identity.

## Security scope (SEC-02 through SEC-11)

- Auth endpoint rate limiting and customer data ownership guards.
- Resource authorization and least-privilege non-disclosure.
- Password-hash leak sanitization on API responses.
- Session revocation on sensitive mutations, and refresh-token reuse detection.
- Authenticated `POST /api/auth/logout-all`.
- Import staff phone-collision protection.
- Refresh-token default `30d` in code. Production keeps `7d` because `backend/.env` was not changed. Access TTL in that file remains `1h`. Staff `rememberMe` remains `90d`.
- Additive columns only: `users.phoneVerifiedAt` and `appointments.priceOverrideReason`.
- Migrations applied: `20261007094913_imported_account_phone_verification` and `20261007095600_appointment_price_override_reason`.

## Verification

- Backend unit tests: 692 passed, 1 skipped, 0 failed.
- Backend integration tests: 116 passed, 0 failed, on loopback database `doocard_test_local`.
- Production `GET http://127.0.0.1:3001/api/health`: `status=ok`, database up.
- `doocard-backend` reloaded once (restart count 24 to 25, unstable restarts 0). `doocard-frontend` was left running.
- Database backup: `/var/backups/doocard/pre_deploy_v2.0.28_20261007_141421.sql.gz` (6181250 bytes).
- Dist rollback copy: `/var/www/doocard/backend/dist_backup_v2.0.16`.

The dump was taken with the local postgres peer socket. `pg_dump -U doocard` could not run without a password, and `backend/.env` was not read.
