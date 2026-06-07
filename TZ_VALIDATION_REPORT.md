# Deterministic Timezone Validation Report — Booking Engine

**Date:** 22 Bahman 1404 (2026-02-11) — 10:32 Tehran  
**Scope:** Validation only. No logic changes, no deploy, no wipe.

---

## 1) Raw logs (from local run)

### STEP 1 — Server time (when GET /api/appointments/slots was called)

```
[TZ-VALIDATE] Server ISO: 2026-02-11T07:44:49.671Z
[TZ-VALIDATE] Server TZ: Asia/Tehran
```

**Note:** In this run the **server process** reported `Asia/Tehran` (Node/Intl resolved the host timezone). In production you may see `UTC` if the server is set to UTC. The slot math uses **explicit** `tehranMidnightUtc` and fixed offset, not the server TZ.

---

### STEP 2 — Window calculation (test date 1404/11/22 → Gregorian 2026-02-11)

**Input:** `date=2026-02-11`, `employeeId=1`, `durationMin=60`.

```
[TZ-VALIDATE] selectedDate: 2026-02-11
[TZ-VALIDATE] tehranMidnightUtc: 2026-02-10T20:30:00.000Z
[TZ-VALIDATE] windowStartUtc: 2026-02-11T05:30:00.000Z
[TZ-VALIDATE] windowEndUtc: 2026-02-11T09:30:00.000Z
```

**Why 05:30–09:30 UTC?**  
Employee 1 has **work schedules** in DB (not default 10–22):

- Weekday 3: `09:00–13:00` and `14:00–18:00` Tehran

So `workingHours[0]` is `{ start: 9, end: 13 }`. The logged window is the **first segment**:

- `windowStartUtc` = tehranMidnightUtc + 9h → **2026-02-11T05:30:00.000Z** → **09:00 Tehran** ✓  
- `windowEndUtc` = tehranMidnightUtc + 13h → **2026-02-11T09:30:00.000Z** → **13:00 Tehran** ✓  

So the **conversion is correct**: 9–13 Tehran is exactly 05:30–09:30 UTC.

**If there were no work schedule (default 10–22):**

- tehranMidnightUtc would still be `2026-02-10T20:30:00.000Z`.
- windowStartUtc = tehranMidnightUtc + 10h = **2026-02-11T06:30:00.000Z** → **10:00 Tehran**.
- windowEndUtc = tehranMidnightUtc + 22h = **2026-02-11T18:30:00.000Z** → **22:00 Tehran**.

So for the **default** 10–22 window, the code would produce an **exact** 10:00–22:00 Asia/Tehran window in UTC. To confirm in logs, use an employee with **no** work schedule (or a schedule that is exactly 10:00–22:00).

---

## 2) UTC values (reference)

| Concept              | UTC (ISO)                 | Tehran equivalent |
|----------------------|---------------------------|--------------------|
| tehranMidnightUtc    | 2026-02-10T20:30:00.000Z  | 2026-02-11 00:00   |
| 10:00 Tehran (default start) | 2026-02-11T06:30:00.000Z | 10:00              |
| 22:00 Tehran (default end)   | 2026-02-11T18:30:00.000Z | 22:00              |
| Logged window (employee 1, first segment) | 2026-02-11T05:30:00.000Z → 2026-02-11T09:30:00.000Z | 09:00 → 13:00 |

---

## 3) Converted Tehran values (manual check)

- **2026-02-11T06:30:00.000Z** → 06:30 + 3:30 = **10:00 Tehran** ✓  
- **2026-02-11T18:30:00.000Z** → 18:30 + 3:30 = **22:00 Tehran** ✓  
- **2026-02-11T05:30:00.000Z** → **09:00 Tehran** ✓  
- **2026-02-11T09:30:00.000Z** → **13:00 Tehran** ✓  

---

## 4) Is the window EXACT 10–22 Tehran?

- **With default working hours (no DB schedule):** **Yes.**  
  - Slot bounds are computed from `tehranMidnightUtc + 10*3600000` and `+ 22*3600000`, which are exactly 10:00 and 22:00 Asia/Tehran in UTC.
- **With employee 1 in this run:** The window is **09:00–13:00** and **14:00–18:00** Tehran (from DB). So it is not 10–22 for this employee, by design (work schedule override). No bug.

---

## 5) STEP 3 — 2-hour rule (simulated expectations)

Validation logs were added in `create()`:

- `[TZ-VALIDATE 2h] nowUtc`, `minAllowedAtUtc`, `selectedStartUtc (scheduledAt)`, `scheduledAt < minAllowedAtUtc` → FAIL/PASS.

**Case A — Now = 10:32 Tehran, book 11:00 Tehran (same day):**  
- minAllowedAtUtc = nowUtc + 2h → e.g. 12:32 Tehran.  
- 11:00 Tehran &lt; 12:32 → **must FAIL** (reject with ۲ ساعت message).

**Case B — Book 12:45 Tehran (same day):**  
- 12:45 &gt; 12:32 → **must PASS**.

To get real logs: run backend locally, obtain a valid JWT, then:

- POST `/api/appointments` with `scheduledAt` = 11:00 Tehran today (expect 400 and FAIL in logs).
- POST with `scheduledAt` = 12:45 Tehran today (expect 201 and PASS in logs).

Comparison is done in UTC (`scheduledAt < minAllowedAtUtc`); “today” is from `toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' })` → **deterministic** regardless of server TZ.

---

## 6) STEP 4 — Midnight boundary

Logs added:

- `[TZ-VALIDATE midnight] nowTehran`, `selectedTehran`, `isToday`.

**Scenario:** Now = 23:30 Tehran, book 00:30 **next day**.  
- `bookingDateTehran` = next day, `todayTehran` = today → `isToday` = false → 2h rule **not** applied → **must PASS**.

So “today” is defined by Tehran calendar day (Intl), not UTC day → midnight boundary is correct.

---

## 7) STEP 5 — DST and timezone usage

| Question | Answer |
|----------|--------|
| **Intl using Asia/Tehran?** | **Yes.** All “today” and display logic use `timeZone: 'Asia/Tehran'` in `toLocaleDateString` / `toLocaleString`. |
| **Relying on system TZ?** | **No** for slot bounds and 2h rule. Slot window uses `tehranMidnightUtc` (derived from fixed offset). “Today” and 2h use explicit `Asia/Tehran`. Server TZ only affects the logged “Server TZ” and any code that did not pass `timeZone` (we do pass it). |
| **Hardcoding offset 3:30?** | **Yes** for **midnight calculation only:** `TEHRAN_OFFSET_MS = (3*60+30)*60*1000` → `tehranMidnightUtc = utcMidnightThatDay - TEHRAN_OFFSET_MS`. Slot start/end then add hours (10, 22 or DB schedule) to that midnight. |
| **Vulnerable to DST?** | **No.** Iran has **no DST** since 2022; Asia/Tehran is fixed UTC+3:30. If it were reintroduced, Intl would follow it for “today” and display; the **midnight** calculation would still use a fixed offset (effectively correct as long as Iran stays UTC+3:30). |

**Summary:** Behaviour is deterministic for Asia/Tehran; not dependent on server TZ for business logic; DST is not a practical concern today.

---

## 8) Any mismatch detected

- **Window 10–22 Tehran:** No mismatch. With default hours, window is exactly 10:00–22:00 Tehran in UTC. With employee 1’s schedule, logged window is 09:00–13:00 Tehran, which matches DB.
- **2h rule:** Logic is correct (UTC comparison, Tehran “today”). No mismatch; STEP 3 logs need to be confirmed by calling `create()` with the two cases above.
- **Midnight boundary:** Logic correct; STEP 4 logs appear when any `create()` is called.

---

## 9) Confidence

**High.**

- Slot window is derived from Tehran midnight + explicit hour offsets; conversion to UTC is correct and yields exact 10:00 and 22:00 Tehran when using default 10–22.
- 2h rule uses `nowUtc`, `minAllowedAtUtc`, and Tehran “today” explicitly; no server TZ in the comparison.
- DST is not in effect for Iran; fixed offset and Intl are aligned.

---

## 10) How to re-run validation (no code change)

1. Start backend: `cd backend && npm run start:dev`.
2. **STEP 1 & 2:**  
   `GET /api/appointments/slots?date=2026-02-11&employeeId=1&durationMin=60`  
   Check console for `[TZ-VALIDATE]` Server ISO/TZ and windowStartUtc/windowEndUtc. For default 10–22, use an employee with no work schedule.
3. **STEP 3 & 4:**  
   POST `/api/appointments` with a valid JWT and body (e.g. `customerId`, `employeeId`, `scheduledAt` or `jalaliDate`+`time`). Check console for `[TZ-VALIDATE 2h]` and `[TZ-VALIDATE midnight]`.

---

**Temporary logs added:** All prefixed with `[TZ-VALIDATE]` / `[TZ-VALIDATE 2h]` / `[TZ-VALIDATE midnight]`. Remove or leave in place as needed; they do not alter any business logic.
