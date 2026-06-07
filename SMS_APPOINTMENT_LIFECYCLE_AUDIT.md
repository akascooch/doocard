# SMS + Appointment Lifecycle Audit

**Scope:** Audit only. No files modified, no deploy, no build.  
**Date:** 2026-02-12

---

## 1️⃣ Files Responsible for Appointment Lifecycle

| Action | HTTP | Controller method | Service method | File (exact path) |
|--------|------|-------------------|----------------|-------------------|
| Create appointment | `POST /appointments` | `create(@Body() dto, @Req() req)` | `AppointmentsService.create(dto, currentUser)` | `backend/src/appointments/appointments.controller.ts` (lines 35–40), `backend/src/appointments/appointments.service.ts` (lines 41–306) |
| Confirm appointment | `POST /appointments/:id/confirm` | `confirm(@Param('id') id, @Req() req)` | `AppointmentsService.confirm(id, currentUser)` | `backend/src/appointments/appointments.controller.ts` (lines 120–126), `backend/src/appointments/appointments.service.ts` (lines 1047–1186) |
| Cancel appointment | `POST /appointments/:id/cancel` | `cancel(@Param('id') id, @Req() req)` | `AppointmentsService.cancel(id, currentUser)` | `backend/src/appointments/appointments.controller.ts` (lines 108–114), `backend/src/appointments/appointments.service.ts` (lines 1004–1039) |

---

## 2️⃣ Per-Action: SMS Injection, Sending, Trigger, Message, Failure Impact

### Create appointment (`POST /appointments`)

- **SMS service injected?** Yes. `FarazSmsSendService` is injected in the constructor as `farazSmsSendService` (line 36). `SmsSendModule` is imported in `AppointmentsModule` (line 9, 18).
- **Is SMS currently sent?** Yes. After creating the appointment and in-app/push notification, `sendAppointmentCreatedSms(appointment)` is called (line 303).
- **Exact function where SMS is triggered:** `AppointmentsService.sendAppointmentCreatedSms(appointment)` (private, lines 314–352).
- **Exact message text:**
  - **Customer:** `نوبت شما با موفقیت ثبت شد.\nآرایشگر: ${employeeName}\nتاریخ: ${dateTimeStr}` (employeeName fallback: `'آرایشگر'`, dateTimeStr: `scheduledAt` formatted with `toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran', ... })`).
  - **Employee:** `نوبت جدید ثبت شد.\nمشتری: ${customerName}\nتاریخ: ${dateTimeStr}` (customerName fallback: `'مشتری'`).
- **Can SMS failure break business logic?** No. The call is `await this.sendAppointmentCreatedSms(appointment)` with no `throw`. Inside `sendAppointmentCreatedSms`, each `sendSingle` is in a try/catch; failures are only logged. Comment on line 302: "Failure must not break creation."

### Confirm appointment (`POST /appointments/:id/confirm`)

- **SMS service injected?** Yes (same constructor; service is used only for create).
- **Is SMS currently sent?** No. Only `notifyAppointmentConfirmed(updated)` is called (line 1133), which uses `NotificationsService` + `NotificationsGateway` (in-app + push). No `farazSmsSendService` or `sendSingle` call.
- **Exact function where SMS would be triggered:** N/A.
- **Exact message text:** N/A.
- **Can SMS failure break business logic?** N/A.

### Cancel appointment (`POST /appointments/:id/cancel`)

- **SMS service injected?** Yes (same as above).
- **Is SMS currently sent?** No. Only `notifyAppointmentCancelled(updated)` is called (line 1037), which uses `NotificationsService` + `NotificationsGateway`. No SMS.
- **Exact function where SMS would be triggered:** N/A.
- **Exact message text:** N/A.
- **Can SMS failure break business logic?** N/A.

---

## 3️⃣ FarazSmsSendService (IPPANEL Edge) – Details

**File:** `backend/src/sms/faraz-sms-send.service.ts`

| Item | Finding |
|------|--------|
| **Endpoint** | `https://edge.ippanel.com/v1/api/send` (constant `EDGE_SEND_URL`, line 16). Matches official docs: `POST {base_url}/api/send` with base `https://edge.ippanel.com/v1`. |
| **Header format** | `Authorization: apiKey` (raw API key, no `Bearer` prefix). Doc says "Authorization: YOUR_TOKEN_HERE" and example "Authorization: API TOKEN" — no Bearer required; consistent. |
| **sending_type** | `'webservice'` (line 56). Matches docs for Webservice SMS. |
| **Phone normalization** | `normalizePhone(recipientPhone)`: (1) `+98...` → as-is; (2) `98...` (length ≥ 12) → `+98...`; (3) `09...` (length 11) → `+98` + rest; (4) else → `null` (no send, no throw). Only Iranian mobile formats supported. |
| **Mask in logs?** | Yes. `maskPhone(phone)` shows last 4 digits only: `***${digits.slice(-4)}`. Used in all log/error messages; full number never logged. |
| **Throws or best-effort?** | Best-effort. Always returns `{ success: boolean, error?: string }`. Never throws. On missing config, invalid phone, or API/network error, returns `success: false` and logs; caller (appointments) does not rethrow. |

---

## 4️⃣ Production ENV Usage

- **SMS_API_KEY:** Read via `this.configService.get<string>('SMS_API_KEY', '')` (line 32). Nest `ConfigService` is populated from `ConfigModule.forRoot()` (app.module), which loads `process.env` (including `.env`). So effectively from `process.env.SMS_API_KEY`.
- **SMS_SENDER_NUMBER:** Read via `this.configService.get<string>('SMS_SENDER_NUMBER', '')` (line 33). Same as above → from `process.env.SMS_SENDER_NUMBER`.
- **Sender E.164 conversion:** Yes. `const fromNumber = sender.startsWith('+') ? sender : \`+98${sender}\`;` (line 55). So values like `3000505` become `+983000505`. Docs require `from_number` in E.164.

---

## 5️⃣ Inconsistencies with Official IPPANEL Edge Docs

- **Endpoint / method / sending_type / headers:** Aligned with [Edge Send](https://ippanelcom.github.io/Edge-Document/docs/send) and [Webservice SMS](https://ippanelcom.github.io/Edge-Document/docs/send/webservice): POST `https://edge.ippanel.com/v1/api/send`, `sending_type: 'webservice'`, `Authorization: <key>`, `Content-Type: application/json`, `from_number` and `params.recipients` in E.164.
- **Optional send_time:** Not sent; message is sent immediately. Allowed by docs.
- **Success check:** Code uses `response?.data?.meta?.status === true`; docs show `meta.status: true` on success. Consistent.
- No other inconsistencies found with the official FarazSMS/IPPANEL Edge production docs.

---

## 6️⃣ Confirmation: When Is SMS Sent?

| Event | SMS sent? |
|-------|-----------|
| Appointment **create** | Yes. Customer + employee (if present) via `sendAppointmentCreatedSms` → `farazSmsSendService.sendSingle`. |
| Appointment **confirm** | No. Only in-app/push via `notifyAppointmentConfirmed`. |
| Appointment **cancel** | No. Only in-app/push via `notifyAppointmentCancelled`. |

---

## 7️⃣ Full Summary

### What works

- **Create flow:** SMS is sent to customer and (if any) employee after appointment creation; messages are clear (Persian, appointment details, Tehran date/time).
- **Failure isolation:** SMS is best-effort; create/confirm/cancel business logic does not depend on SMS success (create explicitly documented and implemented that way).
- **FarazSmsSendService:** Correct Edge URL, `sending_type`, E.164 sender/recipients, Authorization without Bearer, no throw, masked logging.
- **Config:** API key and sender number read from env; sender normalized to E.164.

### What is missing

- **Confirm:** No SMS when an employee/admin confirms an appointment (customer is only notified in-app/push).
- **Cancel:** No SMS when an appointment is cancelled (customer/employee/admin only in-app/push).
- No SMS for other lifecycle events (e.g. settle, reminder) — out of scope for this audit.

### What is risky

- **Catch block in FarazSmsSendService:** In the `catch` branch (lines 94–108), `this.maskPhone(phone)` is used. `phone` is always set before the `try` (line 45) and we only enter `try` when `phone` is non-null, so this is safe. No runtime risk identified.
- **Sender format:** If `SMS_SENDER_NUMBER` is stored with spaces or country code in an unexpected form (e.g. `98 300 0505`), the current logic only trims and adds `+98` when missing; unusual formats might need validation.
- **No retry:** Single attempt per recipient; transient network/5xx failures are not retried (by design for simplicity).

### What must be fixed before adding new SMS behavior

- Nothing **must** be fixed for correctness of current behavior. To **extend** SMS to confirm/cancel (or other events) in a consistent way:
  1. Reuse the same pattern: a private helper (e.g. `sendAppointmentConfirmedSms`, `sendAppointmentCancelledSms`) that calls `farazSmsSendService.sendSingle` in try/catch and does not throw.
  2. Keep SMS strictly best-effort: never throw from these helpers and never let SMS failure change HTTP response or DB state.
  3. Ensure message content (and any new env/template) stays within provider limits and follows the same masking and E.164 rules.

---

**STOP. No changes applied.**
