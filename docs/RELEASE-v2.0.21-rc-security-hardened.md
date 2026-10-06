# v2.0.21 release candidate — security hardened

Local candidate on `release/v2.0.7`. Parent: `924ad57` (`v2.0.20-security-sec06`). Range since `v2.0.17-security-hardening` (`53cf44b`): SEC-04, SEC-05, and SEC-06.

This commit is documentation only. It does not change application code, schema, or authorization.

## Local gate

- `npm --prefix backend run test:unit`: exit 0 (89 suites, 616 passed, 1 skipped).
- `npm --prefix backend run build`: exit 0. `backend/dist/main.js` present.
- `npm --prefix frontend run build`: exit 0. `frontend/.next/standalone/server.js` present. Next.js reported compiled successfully, shared first-load JS 84.6 kB. No bundle-size budget is configured in the repo.

Integration tests were not executed against a database in this gate. `npm run test:integration` remains skip (exit 2) when `TEST_DATABASE_URL` is unset, and it does not connect.

## Authorization kept by this candidate

- Customer self profile: `GET /customers/me` and `GET /customers/me/profile` resolve by JWT user id. A customer can update their own customer row and their own user name.
- Customer appointments were not modified in this range. List, summary, history, and single-record reads stay scoped to the customer row for that user id. Create, list, and cancel remain available to the CUSTOMER role.
- Admin user create, list, role sync, convert-to-employee, and delete stay admin-only. Admin customer reads and updates stay global.

## Operator notes

- Do not set `TEST_DATABASE_URL` on production. Do not run `scripts/full-reset.ts` or `prisma migrate reset`.
- Admin seed and password scripts require `SEED_ADMIN_PASSWORD`, `CREATE_ADMIN_PASSWORD`, `UPDATE_ADMIN_PASSWORD`, `GENERATE_PASSWORD`, or `FULL_RESET_ADMIN_PASSWORD`. They do not embed or print those values.
- Rotate any password that was previously committed in older history if it was ever used on a real database.
