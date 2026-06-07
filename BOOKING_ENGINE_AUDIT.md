# Booking Engine Audit — Doocard

**Audit date:** 2026-02-11  
**Reference time:** 22 Bahman 1404 — 10:32 (Tehran)  
**Scope:** Full booking flow — time accuracy, 2h rule, slots, overlap, timezone, edge cases.  
**Type:** Analysis only (no code changes, no deployment).

---

## 1. Flow diagram (textual)

```
[CUSTOMER DASHBOARD]
       │
       ▼
  Service selection  (frontend: AppointmentForm / book-appointment)
       │
       ▼
  Employee selection (EmployeeSelectFiltered, formData.employeeId)
       │
       ▼
  Date selection     (PersianDatePicker → Jalali YYYY/MM/DD → formData.date)
       │
       ▼
  Available times    GET /api/appointments/slots?date=YYYY-MM-DD&employeeId=&durationMin=...
       │              (Frontend: SlotPickerProfessional converts Jalali→Gregorian via parseFromJalali, sends Gregorian date)
       │              (Backend: getAvailableSlots(dto) — builds slots in UTC for that Gregorian day, applies min_2h for “today” Tehran)
       ▼
  Slot selection     (user picks slot.time = ISO string; formData.time = that ISO)
       │
       ▼
  Create appointment POST /api/appointments { jalaliDate, time: "HH:mm", services, employeeId, customerId, notes }
       │              (Backend: create() — parses Jalali+time → UTC with +03:30, enforces min 2h for today Tehran, advisory lock, overlap/blocked checks)
       ▼
  Database write     (Prisma: Appointment.scheduledAt UTC, calendarDateId set; transaction with pg_advisory_xact_lock)
```

---

## 2. STEP 1 — All involved files

### Backend

| Role | File path |
|------|-----------|
| Controller | `backend/src/appointments/appointments.controller.ts` |
| Service | `backend/src/appointments/appointments.service.ts` |
| DTOs | `backend/src/appointments/dto/get-slots.dto.ts`, `create-appointment.dto.ts`, `appointment-service.dto.ts` |
| Calendar | `backend/src/calendar/calendar.service.ts` |
| Utils (Jalali) | `backend/src/common/utils/date-utils.ts` (used elsewhere); calendar uses `jalaali-js` in calendar.service |
| Prisma | `backend/prisma/schema.prisma` (Appointment, CalendarDate, WorkSchedule, BlockedTime, Service, Employee) |
| Guards | `backend/src/auth/guards/jwt-auth.guard.ts`, `backend/src/common/guards/permission.guard.ts`, `backend/src/common/decorators/roles.decorator.ts` |

### Frontend

| Role | File path |
|------|-----------|
| Booking page (customer) | `frontend/src/app/dashboard/customer/page.tsx` → link to book-appointment |
| Public book page | `frontend/src/app/book-appointment/page.tsx` |
| Form (admin/employee/customer) | `frontend/src/components/appointments/AppointmentForm.tsx` |
| Date picker | `frontend/src/components/ui/PersianDatePicker.tsx` (react-multi-date-picker + persian calendar) |
| Time (slots) picker | `frontend/src/components/appointments/SlotPickerProfessional.tsx` |
| API proxy (slots) | `frontend/src/app/api/appointments/available-slots/route.ts` |
| Date/lib | `frontend/src/lib/date.ts` (parseFromJalali, getCurrentJalaliDate, formatToJalali, persianToEnglishDigits) |
| Booking modal | `frontend/src/components/booking/BookingModal.tsx` |
| Admin new appointment | `frontend/src/app/dashboard/admin/appointments/new/page.tsx` |

---

## 3. STEP 2 — Time source analysis

### 3.1 Source of truth for “current time”

- **Backend:** `new Date()` (e.g. in `appointments.service.ts`: `const now = new Date();` at create and in getAvailableSlots). So “now” is **server wall-clock time** (whatever the Node/OS timezone is).
- **Server timezone:** Not set in code. No `process.env.TZ` or equivalent found in the codebase. So it depends on the host (often UTC in production).
- **Explicit timezone usage:** Only via **Intl** with `timeZone: 'Asia/Tehran'`:
  - `now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' })` for “today” in Tehran (create + getAvailableSlots).
  - `now.toLocaleString('en-US', { ...tehranOpts, hour: '2-digit', minute: '2-digit', hour12: false })` for current clock in Tehran (getAvailableSlots min_2h).
  - Same for slot time in Tehran (getAvailableSlots).
  - SMS date display: `toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })`.

### 3.2 Where timezone is handled

- **process.env.TZ:** Not used.
- **Intl:** Used as above (Asia/Tehran for “today” and for clock comparison in slots).
- **moment-timezone / similar:** Not used in backend. Frontend uses **dayjs** with `jalaliday` and `timezone` in `frontend/src/lib/date.ts`.
- **Jalali:** Backend uses **jalaali-js** in `calendar.service.ts` (`toGregorian`, `toJalaali`, `isValidJalaaliDate`). Frontend uses **jalaali-js** in `lib/date.ts` and **react-multi-date-picker** with persian calendar.

### 3.3 Does backend calculate “today” using Tehran?

- **Yes**, for the 2-hour rule and for slot availability:
  - Create: `todayTehran = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' }); bookingDateTehran = scheduledAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });` then `if (bookingDateTehran === todayTehran)` and `scheduledAt < minAllowedAt` (minAllowedAt = now + 2h in **wall-clock** time, so effectively UTC).
  - getAvailableSlots: `todayTehran = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' }); requestedDate = date.slice(0,10);` then `if (requestedDate === todayTehran)` and for each slot, Tehran clock time is compared (gap in minutes from current Tehran time).

**Exact code lines:**

- Create (min 2h): `backend/src/appointments/appointments.service.ts` lines 92–99.
- getAvailableSlots (min 2h): `backend/src/appointments/appointments.service.ts` lines 779–801.

---

## 4. STEP 3 — Minimum 2-hour rule

### 4.1 Enforced on backend?

- **Yes.** Enforced in `create()` (lines 91–99) and in `getAvailableSlots()` (lines 779–801) for “today” in Asia/Tehran.

### 4.2 Exact condition

**Create:**

```ts
const now = new Date();
const todayTehran = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
const bookingDateTehran = scheduledAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
if (bookingDateTehran === todayTehran) {
  const minAllowedAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  if (scheduledAt < minAllowedAt) {
    throw new BadRequestException('نوبت باید حداقل ۲ ساعت قبل از زمان نوبت ثبت شود');
  }
}
```

**Slots (mark unavailable, do not remove):**

- Same “today” check: `requestedDate === todayTehran` (requestedDate = Gregorian YYYY-MM-DD from query; todayTehran = same format in Tehran).
- For each slot, slot time and “now” are converted to Tehran clock (hour:minute), then `gapMinutes = slotTehranMinutes - currentTehranMinutes`; if `gapMinutes < 120` and slot was available, set `available = false`, `reason = 'min_2h'`.

### 4.3 Timezone-safe?

- **Mostly.** “Today” is correctly defined in Tehran. The 2h window itself uses `now.getTime() + 2*60*60*1000`, so it’s 2 hours in **UTC** (wall-clock), not 2 hours in Tehran. For a server in UTC this is correct; if the server were in another TZ, “2 hours from now” would still be 2 real hours, so behaviour is consistent. So it is timezone-safe in practice.

### 4.4 Edge cases

- **23:30 booking for 01:00 next day:** Date of booking (Tehran) = today; date of slot (Tehran) = next day. So `bookingDateTehran !== todayTehran` for the **scheduled** slot’s date. So the 2h rule does **not** apply (booking is for “tomorrow” in Tehran). Allowed.
- **01:00 booking for 02:00 same day:** If “same day” is still today in Tehran, then 2h rule applies; 1h gap → rejected. Correct.

### 4.5 Comparison in UTC or local?

- **Create:** Comparison is `scheduledAt < minAllowedAt` (both Date objects). So it’s in **UTC** (milliseconds). The **decision** of “is it today?” is in Tehran; the “2 hours from now” is real time (UTC).
- **Slots:** “Today” is compared as Gregorian date string in Tehran. Slot vs “now” gap is computed in **Tehran local clock** (hour*60+min) and compared to 120 minutes.

---

## 5. STEP 4 — Slot generation and overlap

### 5.1 How slots are generated

- **Input:** `GetSlotsDto`: `date` (YYYY-MM-DD Gregorian), `employeeId`, `durationMin` (default 30), `bufferMin` (5), `slotIntervalMin` (60).
- **Day bounds:** `targetDate = new Date(date + 'T12:00:00.000Z')` → `startOfDay` / `endOfDay` with `Date.UTC(gy, gm, gd, 0,0,0,0)` and `... 23,59,59,999`. So the **calendar day is in UTC**.
- **Weekday:** From `calendarService.getByGregorian(targetDate)` → `jalaliDayOfWeek`, else UTC weekday.
- **Working hours:** From `WorkSchedule` for that weekday (HH:MM strings), or default 10–22. Applied as **offsets from startOfDay in UTC**: `currentTime = startOfDay + window.start * 60 * 60 * 1000`, step `slotIntervalMin`. So slots are **UTC** times (e.g. 10:00 UTC, 11:00 UTC, …).
- **Overlap:** Each slot is checked against existing appointments (with buffer) and blocked times; if no overlap, slot is available. All slots (available + busy) are returned; for “today” Tehran, min_2h then marks some available slots as unavailable.

### 5.2 Duration and blocked times

- **Duration:** `durationMin` is used: slot end = slot start + durationMin; slot end must not exceed window end. So service duration is respected per slot.
- **Blocked times:** `BlockedTime` (startAt/endAt UTC) are loaded for that day and checked; overlapping slots are marked busy / not offered.

### 5.3 Overlap at DB level

- **No** unique constraint on (employeeId, scheduledAt). Overlap is prevented by **application logic** inside a **transaction** with an **advisory lock**.

### 5.4 Advisory lock and transaction

- **Yes.** In `create()`: `this.prisma.$transaction(async (tx) => { ... })`. For a given employee: `await tx.$executeRaw\`SELECT pg_advisory_xact_lock(hashtext(CONCAT('employee:', ${dto.employeeId}::text)))\`;` then overlap check and blocked-time check, then create. So **PostgreSQL advisory lock** (per employee) prevents two concurrent creates from double-booking the same employee.

### 5.5 Can two users book the same slot at the same time?

- **No**, for the same employee: the advisory lock serializes concurrent creates for that employee; the overlap check runs inside the same transaction after the lock, so the second request will see the first appointment and get SLOT_CONFLICT (or blocked). For **different employees**, two users can book the same wall-clock slot (different resources) — that is intended.

---

## 6. STEP 5 — Database time storage

### 6.1 How appointment times are stored

- **Prisma:** `scheduledAt DateTime` (no `@db.Timestamptz` in schema; Prisma/Postgres typically store as timestamp; interpretation is app-level).
- **Comment in schema:** `// UTC timestamp (Gregorian with time)`.
- **CalendarDate:** `gregorianDate DateTime @db.Date` (date only). `Appointment.calendarDateId` links to it.

### 6.2 Storing in UTC?

- **Yes.** Create builds `scheduledAt` from `jalaliDate` + `time` as `...T${hour}:${min}:00+03:30` → `new Date(isoWithTZ)`, which is stored as that instant (UTC). So we **do** store UTC.

### 6.3 Converting before save / on read?

- **Before save:** Jalali date + HH:mm (interpreted as Tehran) are converted to one UTC `Date` via the +03:30 ISO string; that `Date` is written to `scheduledAt`.
- **On read:** No conversion in schema. Display code (e.g. SMS) uses `toLocaleDateString(..., { timeZone: 'Asia/Tehran' })` when showing to users.

### 6.4 paidAt, createdAt

- **paidAt:** `DateTime?` — set when payment is recorded; typically server “now” at settlement time (server timezone-dependent unless explicitly set in UTC).
- **createdAt:** `@default(now())` — Prisma “now” (server time, usually UTC if server is UTC). Consistent for ordering; if server TZ changes, only “display” would need care.

---

## 7. STEP 6 — Frontend time display and API payload

### 7.1 Jalali date rendering

- **PersianDatePicker:** `react-multi-date-picker` with `calendar={persian}`. Value is Jalali (e.g. YYYY/MM/DD).
- **getCurrentJalaliDate:** Uses `jalaali.toJalaali(now.getFullYear(), now.getMonth()+1, now.getDate())` — so **browser local date** (user’s “today”). If user is not in Tehran, “today” in Jalali can be wrong for a Tehran-based business.

### 7.2 Selected date → ISO / API

- **Slots:** Frontend converts Jalali → Gregorian with `parseFromJalali(date)` (UTC midnight in `lib/date.ts`), then `toISOString().split('T')[0]` → YYYY-MM-DD sent as `date` to `/api/appointments/slots`. So slots API receives **Gregorian** date.
- **Create:** Frontend sends **Jalali** date + time: `jalaliDate: "1404-11-22"` (YYYY-MM-DD), `time: "14:30"` (HH:mm). No ISO scheduledAt from client in the main flow (AppointmentForm sends jalaliDate + time).

### 7.3 Timezone offset / local date / full ISO

- **Slots:** No timezone offset sent; only `date` (Gregorian YYYY-MM-DD).
- **Create:** No timezone sent; backend assumes time is **Tehran** and uses fixed +03:30.

### 7.4 Example create payload

```json
{
  "services": [{ "serviceId": 2, "priceAtBooking": 20000000, "durationMin": 60 }],
  "employeeId": 1,
  "customerId": 5,
  "jalaliDate": "1404-11-22",
  "time": "14:30",
  "notes": ""
}
```

---

## 8. STEP 7 — Server time check (where to log)

To log server time and timezone **without changing behaviour**, add once at startup or in a health endpoint (e.g. in `backend/src/main.ts` after `bootstrap()` or in a GET handler):

```ts
console.log("Server now:", new Date().toISOString());
console.log("Server TZ:", Intl.DateTimeFormat().resolvedOptions().timeZone);
```

**Suggested place:** `backend/src/main.ts` inside the `bootstrap()` function, right after `await app.listen(...)`.

---

## 9. STEP 8 — Risk points

| Risk | Where | Severity |
|------|--------|----------|
| **Working hours in UTC, not Tehran** | Slots are built as startOfDay + 10h, 11h, … in **UTC**. So “10:00–22:00” is UTC, not Tehran. In Tehran that becomes 13:30–00:30+1. If business intent is “10:00–22:00 Tehran”, slots are shifted. | High (business logic) |
| **Frontend “today” in Jalali** | `getCurrentJalaliDate()` uses browser local date. User in another TZ gets wrong “today” in Jalali for a Tehran salon. | Medium |
| **CalendarService.toJalali uses getFullYear/getMonth/getDate** | These are in **server** local time. If server is not UTC, converting a UTC Date to Jalali can be wrong near midnight UTC. | Low if server is UTC |
| **No DST in Iran** | Iran uses fixed +03:30; no DST. So no DST bug. | None |
| **Midnight boundary** | “Today” is compared as date string (Tehran). Slots for “tomorrow” Gregorian are not filtered by min_2h; correct. Edge at 23:59 Tehran: next calendar day in Tehran is correct. | Low |
| **Race condition** | Mitigated by advisory lock per employee. No double-book for same employee. | Mitigated |
| **Slot display time** | Backend `displayTime` uses `toLocaleTimeString('fa-IR')` without timeZone (server TZ). If server is UTC, backend log/API might show UTC hour. Frontend uses `new Date(slot.time)` and getHours/getMinutes (browser local), so user in Tehran sees correct local time. | Low (display only) |
| **available-slots proxy** | Frontend route uses `API_BASE_URL = 'http://localhost:3001'` (hardcoded in one place). Production likely overrides via env; if not, production frontend could call wrong host. | Config / env |
| **Admin new appointment date** | Admin form uses `date` and `fetchAvailableSlots(dateString, ...)` with `dateString = date.toISOString().split('T')[0]`. If `date` is from a Gregorian picker, it’s correct; if it were Jalali, would be wrong. Need to confirm admin date picker type. | Verify per page |

---

## 10. Final report summary

### 10.1 Flow diagram

- See §1: Customer → service → employee → date (Jalali) → slots (Gregorian date, UTC slots) → slot pick (ISO) → create (Jalali date + HH:mm) → DB (UTC).

### 10.2 Time handling summary

- **Backend:** “Now” = server time. “Today” and “current clock” for rules and slot filtering use **Asia/Tehran** via Intl. Stored times are UTC. Create parses Jalali + time as Tehran (+03:30).
- **Frontend:** Jalali for display and for create; slots request uses Gregorian YYYY-MM-DD. Slot time display uses browser local time (correct for Tehran users). “Today” in Jalali is browser-local (risk if user not in Tehran).

### 10.3 2-hour rule evaluation

- **Enforced on backend:** Yes (create + getAvailableSlots).
- **Only for “today” in Tehran:** Yes.
- **Timezone-safe:** Yes (today in Tehran; 2h in real time).
- **Edge cases:** 23:30 → 01:00 next day allowed; 01:00 → 02:00 same day rejected if &lt; 2h.

### 10.4 Overlap safety evaluation

- **Application-level:** Overlap and blocked-time checks inside `create()`.
- **Concurrency:** PostgreSQL advisory lock per employee inside a Prisma transaction. Prevents double-book for same employee.
- **No DB-level unique constraint** on (employeeId, scheduledAt); reliance is on lock + checks.

### 10.5 Risk list (concise)

1. Working hours applied in UTC → slots may not match “10:00–22:00 Tehran”.
2. Frontend “today” in Jalali depends on browser timezone.
3. Backend `toJalali(date)` depends on server local time (low if server is UTC).
4. Slot display in API/backend logs may be UTC if server is UTC (cosmetic if frontend correct).

### 10.6 Confidence level

- **Medium.** Flow is consistent and 2h rule + overlap logic are correct and timezone-aware for Tehran. Main uncertainty is **slot window interpretation** (UTC vs Tehran) and frontend “today” for non-Tehran users.

### 10.7 Required fixes (without implementing)

1. **Slots:** Make working-window 10:00–22:00 **Asia/Tehran**, not UTC: derive start/end of that window in UTC for the chosen Gregorian day (e.g. 10:00 Tehran = 06:30 UTC, 22:00 Tehran = 18:30 UTC), then generate slots in that UTC range.
2. **Frontend “today” in Jalali:** Use a Tehran “now” (e.g. via a small API that returns current Jalali date in Tehran, or dayjs with timezone 'Asia/Tehran') for initial date and “today” logic so all users see the same salon “today”.
3. **Backend toJalali:** When converting a UTC Date to Jalali, use UTC components (getUTCFullYear, getUTCMonth, getUTCDate) or explicitly format in Asia/Tehran so server TZ does not affect result.
4. **Optional:** Add server time/TZ log at startup (§7) for ops and debugging.
5. **Optional:** Document that `scheduledAt` and BlockedTime are stored in UTC and that working hours in WorkSchedule are “local” (Tehran) so future slot logic can convert them consistently.

---

*End of audit. No code or deployment changes were made.*
