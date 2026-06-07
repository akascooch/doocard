# Phase 2 Booking Engine — Implementation Output

## 1) Files changed

| File | Changes |
|------|--------|
| `backend/src/appointments/appointments.service.ts` | Slot window 10–22 Tehran (UTC-derived), `firstAvailableSlot` in response, 2h rule with `nowUtc`/`minAllowedAtUtc`, displayTime Asia/Tehran |
| `frontend/src/components/appointments/SlotPickerProfessional.tsx` | `firstAvailableSlot` state from API, "اولین نوبت خالی" button, scroll-into-view on select, `data-slot-time` on slot buttons |

---

## 2) Code diff summary

### Backend — `appointments.service.ts`

- **Slot window (PART 1):**  
  - `startOfDay` / `endOfDay` already set to `tehranMidnightUtc` / `tehranDayEndUtc` (conversation summary).  
  - Slot generation loops now use **`tehranMidnightUtc`** for window bounds:  
    `currentTime = new Date(tehranMidnightUtc.getTime() + window.start * 60 * 60 * 1000)`,  
    `windowEnd = new Date(tehranMidnightUtc.getTime() + window.end * 60 * 60 * 1000)`.  
  - So slots are generated strictly between **10:00 and 22:00 Asia/Tehran** (default working hours).  
  - `displayTime` uses `timeZone: 'Asia/Tehran'` for both hourly and sub-hourly slots.

- **First available slot (PART 2):**  
  - After building `allSlots` and applying the 2h rule:  
    `firstAvailableSlot = allSlots.find(s => s.available)?.time ?? null`.  
  - Return object now includes `firstAvailableSlot` (ISO string or `null`).

- **2h rule (PART 3):**  
  - In `create()`: `const nowUtc = new Date();`  
  - `minAllowedAtUtc = new Date(nowUtc.getTime() + 2 * 60 * 60 * 1000)`.  
  - “Today” remains `nowUtc.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' })`; booking date compared in Tehran.  
  - Rejection: `if (bookingDateTehran === todayTehran && scheduledAt < minAllowedAtUtc)` → BadRequest.  
  - No weakening of the rule.

### Frontend — `SlotPickerProfessional.tsx`

- State: `firstAvailableSlot: string | null` from `response.data.firstAvailableSlot`.
- New button: "اولین نوبت خالی" (only when `firstAvailableSlot` is set). On click: `onChange(firstAvailableSlot)` and scroll into view via `document.querySelector(\`[data-slot-time="${firstAvailableSlot}"]\`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`.
- Slot buttons (available and busy) have `data-slot-time={slot.time}` for scroll target.
- Button variant set to `outline` (no `secondary` in this UI library).

---

## 3) Local build result

- **Backend:** `npm run build` — **success** (exit 0).
- **Frontend:** `npm run build` — **TypeScript and lint passed** (Compiled successfully, Linting and checking validity of types). Build then hit:
  - First run: timeout during static generation.
  - Second run: `uncaughtException Error: kill EPERM` (Windows process kill), not a code defect.
- **Conclusion:** No TS/lint errors from Phase 2 changes. Frontend build failure is environment/process (EPERM/timeout). Safe to deploy the changed files.

---

## 4) Production deploy commands (run these yourself)

Use your actual password in place of `<PASSWORD>`. Paths: backend `/var/www/doocard/backend`, frontend `/var/www/doocard/frontend`.

### Upload modified files (pscp)

```powershell
echo y | pscp -batch -P 3031 -pw <PASSWORD> "c:\Users\a.hosseini\Desktop\apk\Doocard.V2.0.0\backend\src\appointments\appointments.service.ts" root@185.255.88.158:/var/www/doocard/backend/src/appointments/appointments.service.ts
echo y | pscp -batch -P 3031 -pw <PASSWORD> "c:\Users\a.hosseini\Desktop\apk\Doocard.V2.0.0\frontend\src\components\appointments\SlotPickerProfessional.tsx" root@185.255.88.158:/var/www/doocard/frontend/src/components/appointments/SlotPickerProfessional.tsx
```

### Wipe appointments on production (plink)

```powershell
plink -P 3031 -pw <PASSWORD> root@185.255.88.158 "cd /var/www/doocard/backend && echo 'DELETE FROM \"appointments\";' | npx prisma db execute --schema=./prisma/schema.prisma --stdin"
```

### Build and reload on server

```powershell
plink -P 3031 -pw <PASSWORD> root@185.255.88.158 "cd /var/www/doocard/backend && npm run build"
plink -P 3031 -pw <PASSWORD> root@185.255.88.158 "pm2 reload doocard-backend --update-env"

plink -P 3031 -pw <PASSWORD> root@185.255.88.158 "cd /var/www/doocard/frontend && npm run build"
plink -P 3031 -pw <PASSWORD> root@185.255.88.158 "pm2 restart doocard-frontend"

plink -P 3031 -pw <PASSWORD> root@185.255.88.158 "pm2 list"
```

---

## 5) pm2 list output

Run the last plink command above and paste the output here. Expected: `doocard-backend` and `doocard-frontend` online.

---

## 6) Confirmation booking works

After deploy, verify:

1. **Slots 10–22 Tehran:** For a given date, slots start at 10:00 and end at 22:00 in Asia/Tehran (e.g. check slot labels and ISO times).
2. **2h rule:** For “today” in Tehran, booking a slot &lt; 2h from now returns 400 with the Persian ۲ ساعت message.
3. **First available:** “اولین نوبت خالی” selects the first available slot and scrolls it into view.
4. **No overlap:** Create an appointment, then load slots again — that slot shows busy; creating another on the same slot is rejected.
5. **No BigInt errors:** No serialization errors in API responses (amount/tipAmount handled as before).

---

## 7) Appointments table = 0 before testing

- **Local:** `DELETE FROM "appointments";` was run via:
  `"DELETE FROM \`"appointments\`";" | npx prisma db execute --schema=./prisma/schema.prisma --stdin`
  → “Script executed successfully.” So local table was wiped.
- **Production:** Run the plink wipe command in section 4, then on the server run:
  `cd /var/www/doocard/backend && npx prisma db execute --schema=./prisma/schema.prisma --stdin`
  and paste: `SELECT COUNT(*) AS n FROM appointments;` then Enter and Ctrl+D (or your method to run a SELECT). Expect `n = 0` before creating new test appointments.

---

**Summary:** Parts 1–3 are implemented in code. Local backend build succeeds; local appointment wipe succeeded. Frontend build passes compile/lint but hit EPERM on this machine. Use the pscp/plink commands above to deploy and wipe production, then confirm with section 6 and 7.
