# SMS Lifecycle Deployment Report

**Date:** 2026-02-12  
**Scope:** Full SMS lifecycle (create + confirm + cancel), branded copy, non-blocking, deploy via pscp/plink.

---

## 1. Files modified

| File | Changes |
|------|--------|
| `backend/src/appointments/appointments.service.ts` | • Added `getAppointmentSmsVars()` (jalaliDate, time, serviceNames, employeeName, customerName).<br>• Replaced create SMS with branded copy (دوکاردی عزیز 💈, pending approval, emojis, services).<br>• Added `sendAppointmentConfirmedSms()` (customer only) and call from `confirm()` after notify.<br>• Added `sendAppointmentCancelledSms()` (customer only) and call from `cancel()` after notify.<br>• All SMS calls wrapped in try/catch; failures logged/warned, never thrown.<br>• `cancel` and `confirm` update includes `calendarDate: true` for SMS vars. |

---

## 2. pscp commands executed

```bash
echo y | pscp -batch -P 3031 -pw AMFZg36oL87h4oaGj0 "c:\Users\a.hosseini\Desktop\apk\Doocard.V2.0.0\backend\src\appointments\appointments.service.ts" root@185.255.88.158:/var/www/doocard/backend/src/appointments/appointments.service.ts
```

**Result:** Success (file uploaded).

---

## 3. plink commands executed

```bash
plink -P 3031 -pw AMFZg36oL87h4oaGj0 root@185.255.88.158 "cd /var/www/doocard/backend && npm run build"
```
**Result:** Success.

```bash
plink -P 3031 -pw AMFZg36oL87h4oaGj0 root@185.255.88.158 "pm2 reload doocard-backend --update-env"
```
**Result:** Success.

```bash
plink -P 3031 -pw AMFZg36oL87h4oaGj0 root@185.255.88.158 "cd /var/www/doocard/frontend && npm run build"
```
**Result:** Success (exit 0; static-generation warnings only).

```bash
plink -P 3031 -pw AMFZg36oL87h4oaGj0 root@185.255.88.158 "pm2 restart doocard-frontend"
```
**Result:** Success.

---

## 4. pm2 list output

```
┌────┬─────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name                │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼─────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0  │ doocard-backend     │ default     │ 1.2.4   │ fork    │ 266127   │ 3m     │ 20   │ online    │ 0%       │ 117.2mb  │ root     │ disabled │
│ 1  │ doocard-frontend    │ default     │ N/A     │ fork    │ 267654   │ 0s     │ 11   │ online    │ 0%       │ 18.2mb   │ root     │ disabled │
└────┴─────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

**Backend:** online  
**Frontend:** online  

---

## 5. Manual test confirmation (to be done by you)

Please confirm on **www.doocardbarbershop**:

1. **Create booking**  
   Create an appointment (customer or admin).  
   **Expected:** Customer and barber (if assigned) receive SMS with:
   - دوکاردی عزیز 💈
   - نوبت شما با موفقیت ثبت شد و در انتظار تایید آرایشگر است (customer)  
   - یک نوبت جدید ثبت شده و نیاز به تایید شما دارد (barber)  
   - آرایشگر/مشتری، تاریخ (jalali)، ساعت، خدمات  
   - “پس از تایید، پیامک نهایی…” (customer) / “لطفاً در پنل مدیریت…” (barber)

2. **Confirm booking**  
   As employee/admin, confirm the same appointment.  
   **Expected:** Customer receives SMS:
   - دوکاردی عزیز 💈
   - نوبت شما تایید شد ✅
   - آرایشگر، تاریخ، ساعت، خدمات
   - منتظر دیدار شما هستیم 🌟

3. **Cancel booking**  
   Cancel an appointment (customer or admin).  
   **Expected:** Customer receives SMS:
   - دوکاردی عزیز 💈
   - متأسفانه نوبت شما لغو شد ❌
   - آرایشگر، تاریخ، ساعت
   - از آرایشگاه با شما تماس گرفته می‌شود برای هماهنگی نوبت جدید.

4. **Non-blocking**  
   If SMS fails (e.g. wrong/missing SMS_API_KEY), appointment create/confirm/cancel must still succeed; only logs should show SMS failure.

---

## 6. Summary

- **Local build:** Passed.
- **Server backend build:** Passed.
- **Server frontend build:** Passed.
- **pm2 reload (backend) / restart (frontend):** Succeeded.
- **pm2 list:** Both processes online.
- **SMS logic:** Create (customer + barber), confirm (customer), cancel (customer); all with branded copy and try/catch; no throw.

Manual SMS tests (create, confirm, cancel) and non-blocking check remain for you to run on production.
