# Next sprint candidates

Recorded 2026-10-08 after v2.0.29 closeout. Production baseline remains commit `c038abb2847985267546655c0464ebc7634f879d`, tag `v2.0.29-prod`, BUILD_ID `O0Q0yo8v1ytFqAS_r-6uz`. None of these items are release blockers. Do not deploy them without a separate local verification cycle.

## P2 — Install `sharp` for the Linux standalone image optimizer

`frontend/package.json` does not depend on `sharp`. `next/image` is used by `frontend/src/components/common/AppLogo.tsx` and `frontend/src/components/auth/AuthSplitShell.tsx`. `frontend/next.config.js` asks the optimizer for `image/webp` and `image/avif`.

After the v2.0.29 frontend reload, PM2 `doocard-frontend` still logged `Error: 'sharp' is required to be installed in standalone mode`. HTML routes and `/api/health` stayed 200. The same residual was already noted in the 2026-09-22 closeout.

Next change: add `sharp` on the Ubuntu build and confirm the standalone `node_modules` contains the Linux binary. Do not copy a Windows `sharp` build into production.

## P2 — Make push subscribe idempotent on the global endpoint

`PushSubscription.endpoint` is `@unique` in `backend/prisma/schema.prisma`. `PushNotificationsService.subscribe` updates a row only when `userId` and `endpoint` both match. Any other create hits Prisma `P2002`. `AllExceptionsFilter` maps that to HTTP 409 `DUPLICATE_ENTRY`.

On 2026-10-08 20:28 +0330 the live backend logged that 409 for `POST /api/push-notifications/subscribe` (user 1) after boot. The process stayed up. Same-user refresh already works when the lookup finds the row. The 409 is the miss path: the endpoint exists under another user, or two creates race.

Next change: on `P2002`, refresh `p256dh` and `auth` for that endpoint instead of throwing. Decide explicitly what happens if the stored `userId` differs. Do not log the full endpoint.

## P3 — Staff `AppointmentForm` still books several services as one appointment

`frontend/src/components/appointments/AppointmentForm.tsx` posts one body: one `employeeId` and a `services` array. `frontend/src/lib/booking-selections.ts`, used by `BookingModal`, sends `selections` only when extra lines exist. A single service stays the legacy one-appointment body. Phase 3 recorded the staff form behavior and left it unchanged on purpose.

Next change only if the product owner wants the staff form to create one appointment per service and barber. Do not treat this as a defect fix inside the current form.

## Already recorded, not re-scoped here

Salary and guarantee cheque reminders, and the unlinked MANUAL expense that stays beside a cleared cheque, remain owner decisions in `docs/RELEASE-v2.0.14-status-settlement-sprint.md`.
