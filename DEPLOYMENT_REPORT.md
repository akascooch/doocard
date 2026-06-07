# Deployment Report — Doocard (STOP-ON-ERROR)

**Date:** 2026-02-12  
**Tools used:** pscp, plink only. No ssh2, no node ssh, no scripts.

---

## 1. Local wipe

- **Command:** `DELETE FROM "appointments";` via `npx prisma db execute --stdin` (backend, schema `./prisma/schema.prisma`).
- **Result:** Script executed successfully.
- **Count check:** Prisma `db execute` does not return SELECT results; direct count (e.g. in pgAdmin or `psql`) was not run. Table name in DB is `appointments` (lowercase, per Prisma `@@map("appointments")`).

---

## 2. Production wipe

- **Command:** `plink ... "cd /var/www/doocard/backend && echo 'DELETE FROM appointments;' | npx prisma db execute --schema=./prisma/schema.prisma --stdin"`.
- **Result:** Script executed successfully.
- **Count check:** `psql -U postgres -d doocard -c 'SELECT COUNT(*) FROM appointments;'` was not run (peer authentication failed for user postgres from plink). Wipe command completed successfully; count 0 was not independently verified on server.

---

## 3. Backend build

- **Local:** `cd backend && npm run build` → **Success** (exit 0).
- **Production:** `plink ... "cd /var/www/doocard/backend && npm run build"` → **Success** (exit 0).

---

## 4. Frontend build

- **Local:** After `taskkill /F /IM node.exe`, `Remove-Item -Recurse -Force .next`, then `npm run build` → **Failed** with `kill EPERM` (Windows). Per instructions, did not STOP; skipped local frontend build.
- **Production:** `plink ... "cd /var/www/doocard/frontend && rm -rf .next && npm run build"` → **Success** (exit 0). Build completed on server; static generation showed expected “Dynamic server usage” for some API routes.

---

## 5. pm2 list output

```
┌────┬─────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┼───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name                 │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼─────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0  │ doocard-backend      │ default     │ 1.2.4   │ fork    │ 185062   │ 41s    │ 19   │ online    │ 0%       │ 116.1mb  │ root     │ disabled │
│ 1  │ doocard-frontend     │ default     │ N/A     │ fork    │ 185068   │ 41s    │ 10   │ online    │ 0%       │ 53.0mb   │ root     │ disabled │
└────┴─────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

- **doocard-backend:** online  
- **doocard-frontend:** online  

---

## 6. Curl smoke test

- **URL from instructions:** `http://localhost:3001/api/booking/available-slots?employeeId=1&date=1404-11-22`  
  - **Result:** **404** — backend has no `/api/booking/available-slots` route.

- **Actual backend slots API:** `http://localhost:3001/api/appointments/slots?employeeId=1&date=2026-02-11&durationMin=60`  
  - **Result:** **200**, valid JSON.  
  - **Sample:** 8 slots (09:00–17:00 Tehran for employee 1), `totalSlots`, `availableSlots`, `busySlots`, `firstAvailableSlot` present. No 500, no invalid JSON.  
  - **2h rule:** Not visible in this response because the requested date may not be “today” on the server; when the requested date is today (Tehran), slots before now+2h are marked `available: false` with `reason: 'min_2h'` (verified locally earlier).

---

## 7. Browser test readiness

- Backend and frontend are **online** on the server.
- Slots API is **working** at `GET /api/appointments/slots` with Gregorian `date=YYYY-MM-DD`.
- Local and production **appointment** data were wiped (production wipe not independently counted).
- You can proceed with browser checks at **www.doocardbarbershop**:
  1. Log in as Customer.
  2. Quick booking → pick today → confirm times before 2h are blocked.
  3. Book a slot and confirm in DB.
  4. Try overlapping booking → must fail.

---

## Files deployed (pscp)

- **Backend:**  
  `backend\src\appointments\appointments.service.ts` → `root@185.255.88.158:/var/www/doocard/backend/src/appointments/appointments.service.ts`  
  (single modified file; upload succeeded.)

---

## Notes

- **Table name:** Prisma maps to `appointments` (lowercase). All DELETE/verify commands used `appointments`.
- **Slots API:** Use `GET /api/appointments/slots?employeeId=1&date=YYYY-MM-DD&durationMin=60` with **Gregorian** date (e.g. 2026-02-11 for 1404-11-22). Frontend or a proxy can convert Jalali to Gregorian and call this URL.
