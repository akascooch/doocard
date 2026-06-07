# Booking Time Window Audit — Why Slots Stop at 17:00 Instead of 21:00

**Scope:** Investigation only. No code changed, no deploy.

---

## STEP 1 — Slot generation source

### Where time slots are generated

| Item | Location |
|------|----------|
| **Primary function** | `getAvailableSlots(dto: GetSlotsDto)` |
| **File** | `backend/src/appointments/appointments.service.ts` |
| **Approx. lines** | 645–935 (slot building and 2h rule) |

**Relevant symbols:**

- **`workingHours`** — Array of `{ start, end }` (decimal hours from midnight). Built at lines 702–712: either from **DB work schedules** (`workSchedules.map(ws => ({ start: startHour + startMin/60, end: endHour + endMin/60 }))`) or **default** `[{ start: 10, end: 22 }]`.
- **Slot loops** — Two `for (const window of workingHours)` loops (lines 784–824 and 826–873). Each window: `currentTime` from `tehranMidnightUtc + window.start * 60 * 60 * 1000`, `windowEnd` from `tehranMidnightUtc + window.end * 60 * 60 * 1000`. Slots generated with `slotIntervalMin` step; slot end = `currentTime + durationMin`; if `slotEnd > windowEnd` the loop breaks (no slot added).
- **Constants controlling start/end hour in code:**  
  Only the **default** when there are no work schedules: **start 10, end 22** (line 713: `[{ start: 10, end: 22 }]`).  
  When work schedules exist, **start and end come only from DB** (`WorkSchedule.startTime` / `endTime`), not from any other constant.

**Not present in codebase (searched):**

- `generateSlots`, `buildTimeWindow`, `START_HOUR`, `END_HOUR`, `openHour`, `closeHour`, `addHours` (no matches).
- `slotInterval` as a name: slot step is **`slotIntervalMin`** (from DTO, default 60).
- `for (let hour` — slots are built by adding `slotIntervalMin` to `currentTime`, not by a simple hour loop.

### Backend vs frontend

- **Backend only.** Slots are generated entirely in `AppointmentsService.getAvailableSlots()`. Frontend only calls the API and displays `response.data.slots`; it does not generate or alter the slot list.

---

## STEP 2 — Working hours configuration

### Where 17 comes from

- **17 is not hardcoded** anywhere in the slot or appointment logic.
- The **last slot start** appears as **17:00** when the **work schedule window for that segment ends at 18:00** and the slot length is **1 hour**:
  - With `window.end = 18` and `slotIntervalMin = 60`, the last slot that fits is **start 17:00, end 18:00**.
  - So “slots stop at 17:00” means: **last slot start = 17:00**, which implies **window end = 18** for that employee/weekday.

### Source of working hours

| Source | Where defined | Effect |
|--------|----------------|--------|
| **Employee work schedule (DB)** | Table `work_schedules`: `employeeId`, `weekday`, `startTime`, `endTime` (strings `"HH:MM"`), `isActive`. | For each (employee, weekday), all active rows are loaded and converted to `{ start, end }` in decimal hours. **Multiple segments per day are allowed** (e.g. 09:00–13:00 and 14:00–18:00). |
| **Default fallback** | `backend/src/appointments/appointments.service.ts` line 713. | If `workSchedules.length === 0`, `workingHours = [{ start: 10, end: 22 }]` (10:00–22:00 Tehran). |

So:

- **Where 17 is coming from:** From the **employee’s WorkSchedule** for that weekday: one of the segments has **endTime** such that the last slot **start** is 17:00. Typically that segment is **14:00–18:00** (or similar), i.e. **end hour 18** in DB.
- **Hardcoded or calculated:** **Calculated** from DB. The only hardcoded range in code is **10–22** (default when no work schedule exists).

### Global / shop-level config

- There is **no** global “shop open/close” or “default 8–17” in the slot logic. The only default is **10–22** when an employee has **no** work schedule rows for that weekday.

---

## STEP 3 — Timezone logic

| Question | Answer |
|----------|--------|
| **How current time is calculated** | `const nowUtc = new Date()` (and `now = nowUtc`) used for the 2h rule (lines 876, 888). For slot **window** bounds, no “current time” is used; only the **selected date** and **Tehran midnight** are used. |
| **Is Asia/Tehran enforced?** | Yes for **window and display:** `tehranMidnightUtc` is derived from Gregorian date + fixed offset `TEHRAN_OFFSET_MS = (3*60+30)*60*1000` (UTC+3:30). Slot start/end are `tehranMidnightUtc + window.start/end` hours. Display uses `timeZone: 'Asia/Tehran'` in `toLocaleTimeString` / `toLocaleDateString`. “Today” for the 2h rule uses `toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' })`. |
| **Is server time used?** | Only indirectly: `new Date()` is server’s “now” for the 2h rule. Slot **generation** does not use server time; it uses the **requested date** and Tehran midnight. |
| **Is `new Date()` used directly?** | Yes: for “now” in the 2h rule and for building slot timestamps from `tehranMidnightUtc` and window start/end. |
| **UTC conversion before slot building?** | Yes. The **day** is interpreted in UTC (Gregorian `date` YYYY-MM-DD → `utcMidnightThatDay`), then **Tehran midnight** is `utcMidnightThatDay - TEHRAN_OFFSET_MS`. Slot bounds are **UTC** instants: `tehranMidnightUtc.getTime() + window.start/end * 60 * 60 * 1000`. So slots are built in UTC from an Asia/Tehran-defined day and window. |

---

## STEP 4 — Slot interval

| Item | Detail |
|------|--------|
| **Slot interval in minutes** | **`slotIntervalMin`** from `GetSlotsDto`. Default in code: **60** (line 649: `slotIntervalMin = 60`). Frontend can override (e.g. SlotPickerProfessional sends `slotIntervalMin: 60`). |
| **Configurable?** | Yes. It’s an optional query/body parameter; validation `@Min(5)` in `get-slots.dto.ts`. |
| **Does service duration affect last slot?** | Yes. A slot is only added if `slotEnd <= windowEnd` (strict: `if (slotEnd > windowEnd) break`). So `slotEnd = currentTime + durationMin`. With 1h duration and window end 18:00, last slot start is 17:00. If **durationMin** were 30, last slot start could be 17:30. So both **window end** (from work schedule) and **durationMin** determine the last slot. |

---

## STEP 5 — 2-hour rule

| Item | Detail |
|------|--------|
| **Where implemented** | `backend/src/appointments/appointments.service.ts`, lines 886–912, inside `getAvailableSlots()`. |
| **Before or after generation** | **After** generation. All slots are first built in `allSlots`; then, if **requested date === today (Tehran)**, each slot’s **Tehran time** is compared to **current Tehran time**; if the gap is &lt; 2 hours and the slot was available, it is marked `available = false` and `reason = 'min_2h'`. |
| **Today only (Asia/Tehran)?** | Yes. `todayTehran = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' })`, `requestedDate = date.slice(0,10)` (Gregorian YYYY-MM-DD). Rule runs only when `requestedDate === todayTehran`. |

---

## STEP 6 — Structured report

```
Slot generation source:
  backend/src/appointments/appointments.service.ts
  getAvailableSlots(dto)
  Two loops: for (const window of workingHours) with currentTime from tehranMidnightUtc + window.start, windowEnd from tehranMidnightUtc + window.end; step slotIntervalMin; slot end = currentTime + durationMin; if slotEnd > windowEnd then break.

Start hour:
  From workingHours[].start. If employee has work schedules: from DB work_schedules.startTime (e.g. 9 → 09:00). If no work schedules: default 10 (10:00 Tehran).

End hour:
  From workingHours[].end. If employee has work schedules: from DB work_schedules.endTime (e.g. 18 → 18:00). If no work schedules: default 22 (22:00 Tehran).

Where 17 is coming from:
  Not hardcoded. The last slot START is 17:00 when the employee's WorkSchedule for that weekday has a segment with endTime = "18:00" (and slot interval 60 min, duration 60 min). So 17 is the last slot start; the window end in DB for that segment is 18. Check work_schedules table for the employee/weekday you are testing (e.g. endTime = '18:00' or second segment 14:00–18:00).

Timezone source:
  Asia/Tehran enforced for day and display. Tehran midnight from fixed UTC+3:30. Slot bounds are UTC instants derived from that. Current time for 2h rule: new Date() (server now), "today" from toLocaleDateString(..., { timeZone: 'Asia/Tehran' }).

Slot interval:
  slotIntervalMin from DTO; default 60 (minutes). Configurable via API (@Min(5)). Duration affects last slot (slot must fit within window end).

2-hour rule location:
  getAvailableSlots(), after allSlots built. Applied only when requested date === today (Tehran). Marks slot.available = false and slot.reason = 'min_2h' when gap from current Tehran time to slot start < 2 hours. Does not remove slots; only marks them unavailable.

Working hours config:
  Per-employee, per-weekday, in DB table work_schedules (startTime, endTime as "HH:MM", isActive). Multiple rows per (employeeId, weekday) = multiple segments per day. No global shop open/close. Default when no rows: 10–22 Tehran.

Conclusion:
  Slots stop at 17:00 because the employee's work schedule for that day has a segment ending at 18:00 (e.g. 14:00–18:00). With 60-minute slots and 60-minute duration, the last slot start is 17:00. To have slots until 21:00, the work_schedules rows for that employee/weekday must have a segment with endTime at least 22:00 (e.g. extend the second segment to 14:00–22:00 or add a segment that ends at 22:00). No code change is required; only DB data (work_schedules.endTime) needs to be updated for the relevant employee/weekday.
```

---

**No code was modified. No deployment was performed.**
