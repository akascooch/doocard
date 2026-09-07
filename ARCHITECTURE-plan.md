# Architecture Plan

**Project:** Doocard Barbershop Management  
**Workspace:** `C:\scooch\Versions\v.2.0.4`  
**App version in manifests:** backend/frontend `2.0.5`  
**Document date:** 2026-09-07 (Asia/Tehran)  
**Status:** LOCAL PLAN ONLY — no code, no migration, no production  
**Authoritative evidence:** local source + prior discovery (this file does not invent folders)

---

## 1. Goals / Description

Deliver a **local-first, reversible** implementation plan for seven product requests, then wait for explicit approval before writing code or deploying.

| # | Goal | Nature |
|---|------|--------|
| R1 | Settlement stops sending SMS; keep in-app; add Web Push to match tip path | Code + SMS policy |
| R2 | Tip alerts stay in-app + Socket + Web Push; **no SMS** | Verification / parking-lot (already done in this tree) |
| R3 | Withdrawal history respects Jalali `from`/`to`; Admin + Employee get «ماه جاری» | Query params + UI; **must not mutate payroll math** |
| R4 | Yearly financial chart shows volume (`appointmentCount`) and revenue amount | Additive DTO + dual-axis UI |
| R5 | Admin/barber appointment service picker: most-used first | Authenticated `GET /services` sort |
| R6 | Barber appointment customer search: only customers linked to that barber | Access-control (opt-in query, not silent default-scope of all `/customers`) |
| R7 | Admin customer picker shows preferred barber name on each row | UI-only (API already includes the relation) |

**Non-goals for this plan**

- Production deploy, PM2 reload, SSH, DB restore, or `prisma migrate` on the server.
- New Prisma migrations (none of R1–R7 require schema change).
- Dropping columns/tables.
- Disabling in-app notifications.
- Sending SMS from local/test.
- Invented multi-tenant filters (`tenantId` / `barbershopId` **do not exist** in `schema.prisma`).
- Invented folders (`backend/src/features/appointments`, Fastify, `clientOfId`, `assignedBarberId`).

---

## 2. What I verified (real tree)

| Claim | Evidence |
|-------|----------|
| Stack | NestJS 10 + Prisma 6 + Next.js 14.1; folders `backend/` and `frontend/` |
| Not Fastify | `backend/package.json` `@nestjs/*` |
| No tenant column | `rg tenantId\|barbershopId` on `schema.prisma` → **zero matches** |
| Customer link | `Customer.preferredEmployeeId` → `Employee` (`schema.prisma` ~102–117). No `deletedAt` on `Customer` |
| Soft-delete exists on | `Appointment.deletedAt`, `Transaction.deletedAt`, some accounting entities — **not** on `Customer` or `Service` |
| Settlement SMS | `AppointmentsService.notifyAppointmentSettled` calls `smsOutbound.sendIfAllowed` (`appointments.service.ts` ~2443) |
| Settlement in-app | Same method: `notificationsService.create` + `notificationsGateway.sendToUser` for customer and barber |
| Settlement Web Push | **Absent** in `notifyAppointmentSettled`. Push **is** used for create/confirm and for tips |
| Tip SMS | `TipAlertService` has no `SmsOutboundService` injection; policy `tip.received` default false + force-off on boot |
| Withdrawals list | `GET /employees/me/withdrawals` → `listMyWithdrawals` — **no date params**; filters `deletedAt: null`, `type: EXPENSE`, `employeeId` |
| Payroll preview dates | Admin `GET /admin/employee-salary/preview?from&to` **does** filter DB via `occurredAt` / `paidAt` (`gt` start, `lte` end) |
| Financial chart | `GET /admin/financial/yearly-report` → `AdminFinancialService.getYearlyReport`. UI: `frontend/src/app/dashboard/admin/financial/page.tsx` |
| Dead chart | `frontend/src/components/accounting/monthly-chart.tsx` calls `/accounting/monthly-chart` — **no Nest route** |
| Public service popularity | `GET /services/public` → `findAllPublic()` JSON `@>` on `appointments.services` |
| Authenticated services | `GET /services` → `findAll()` `orderBy: { createdAt: 'desc' }` used by `AppointmentForm` |
| Barber my-customers | `GET /customers?mine=1` already scoped; appointment `CustomerTypeahead` search is **intentionally unscoped** |

**Production (from `C:\scooch\ip.txt`, not re-probed this turn):** live tree was dirty `main` @ `0537c56`; v2.0.5 code deploy was **blocked**. Tip-alert code in this workspace may **not** be live. `SMS_ENABLED=true` was recorded for prod.

---

## 3. Confirmed project structure

```
C:\scooch\Versions\v.2.0.4\
  backend\          NestJS API (nest-cli.json here — bootstrap from this folder)
    prisma\schema.prisma
    src\appointments\
    src\sms\
    src\admin\
    src\customers\
    src\employees\
    src\services\
    src\notifications\
    src\push-notifications\
  frontend\         Next.js 14 App Router
    src\app\dashboard\admin\
    src\app\dashboard\employee\
    src\components\appointments\
```

There is **no** `backend/src/features/`. There is **no** `settle.service.ts`.

---

## 4. Confirmed tech stack

- Backend: NestJS 10, Prisma 6.19, PostgreSQL, Socket.IO namespace `/notifications`, Bull, Redis cache
- SMS: `FarazSmsSendService` (`SMS_PROVIDER` = `faraz` \| `smsir`), `SmsOutboundService.sendIfAllowed`, always-CC inside that method
- Frontend: Next 14.1, Zustand notification store, Recharts, Jalali helpers in `frontend/src/lib/date.ts`
- Money: rial `BigInt` in DB; UI تومان (`/ 10`)

Local DB vs prod DB versions differ (local notes say PG18; prod notes say **14.24**). Plan treats them as **separate environments**.

---

## 5. Architecture report (notify + money)

### Settlement (R1)

```
POST /appointments/:id/settle  (ADMIN, ACCOUNTANT)
  → AppointmentsService.settle()          // Prisma $transaction — financial source of truth
  → post-commit:
       notifyAppointmentSettled()         // in-app + SMS today; add push; drop SMS
       tipAlertService.notifyTipRecipients()  // if allocations exist
```

Checkout must remain **soft-fail** on notify. Do **not** wrap SMS/push inside the money `$transaction`.

### Tips (R2)

```
settle() or AdminTipsService.create()
  → TipAlertService.notifyTipRecipients()
       notifications + Socket.IO + Web Push
       // no sendIfAllowed
```

Recipients = **SERVICE (and any employee in `allocations`)**, not “the barber of the appointment” unless that employee is in the allocation list. TEAM tips split to selected SERVICE staff. Admin is **not** in this path.

### Withdrawals (R3)

Two different APIs:

| Surface | Endpoint | Date filter today |
|---------|----------|-------------------|
| Employee history table | `GET /employees/me/withdrawals` | **None** |
| Admin «برداشت‌های دوره» | `GET /admin/employee-salary/preview?from&to` | Yes (`occurredAt`) |
| Employee preview | `GET /employees/me/salary-request/preview?from&to` | Yes (90-day cap) |

R3 implementation = **history list** `from`/`to` + UI «ماه جاری». Do **not** change `findPriorWithdrawals` `gt`/`lte` (payroll net payable).

### Financial (R4)

`getYearlyReport(jy)` already loops `getJalaliMonthRanges(jy)` and sums `appointment.amount` for settled statuses on `paidAt`. Add `appointmentCount` in the same `where`. Frontend dual-axis on **that** page, not the dead monthly-chart component.

---

## 6. Database and business domain

| Table | Use in this plan |
|-------|------------------|
| `appointments` | Settlement notify; R4 count/sum on `paidAt`; `deletedAt IS NULL`; JSON `services` + relation `appointment_services` |
| `appointment_services` | R5 usage count (preferred over JSON `@>`) |
| `appointment_tip_allocations` | Tip recipients after settle |
| `tip_sources` / `manual_tip_allocations` | Manual tips |
| `notifications` | `APPOINTMENT_SETTLED`, `TIP_RECEIVED` |
| `sms_events` | Dedupe / audit; R1 should stop new SENT rows for `appointment.settled` |
| `sms_notification_rules` | `appointment.settled` must become `smsEnabled=false` **and stay false on boot** |
| `sms_templates` | Keep `appointment_settled_barber`; unused if call removed |
| `transactions` | Withdrawals: `occurredAt` (business time), **not** `createdAt`; `deletedAt IS NULL` |
| `customers` | `preferredEmployeeId` = barber link for R6/R7. **No** `deletedAt` |

**Migration:** none required. If a future index is wanted (`appointment_services(serviceId)` already unique with appointment), it is optional and additive — not in v1 of this plan.

---

## 7. Local run / dev report

- Bootstrap backend from the folder that contains `nest-cli.json` (`backend/`).
- Tests: `backend` Jest (`npm test` / targeted specs). Do not hit Faraz/sms.ir: mock `SmsOutboundService`; `SMS_ENABLED` must not be true in test env (do not read or print `.env*`).
- Do not run production SSH as part of implementing this plan.

---

## 8. Server / production report

**Out of scope until local verification + explicit owner approval.**  
Known drift: local `v.2.0.4` vs `ip.txt` still mentioning `v.2.0.3.3`; production git dirty; v2.0.5 not applied. **Do not** `git pull` on `/var/www/doocard` while dirty.

R2 production check is a **read-only** later task (`grep TipAlertService` on server source / confirm `NotificationType.TIP_RECEIVED` in runtime), not a deploy.

---

## 9. Red-line decisions (must confirm before code)

### R1 — Settlement SMS: policy vs bug?

**Recommendation (two layers, as you described):**

1. **Code:** stop calling `smsOutbound.sendIfAllowed` in `notifyAppointmentSettled`. That also stops **always-CC for this event**, because CC is inside `sendIfAllowed` (`sms-outbound.service.ts` ~50–55, ~142–148).
2. **Policy:** `DEFAULT_SMS_POLICY` for `appointment.settled` → `smsEnabled: false`, **and** `ensureDefaults()` `update` must **force** `smsEnabled: false` on every boot (copy the `TIP_RECEIVED` pattern). Otherwise an old DB row stays `true` and an admin toggle (or a future caller) can send SMS again.

**Always-CC globally:** do **not** disable `SMS_ALWAYS_CC_PHONES` for other events (welcome, appointment created, cheque reminder). Only settlement event traffic stops.

**Web Push:** user asked in-app + Web Push. Today settlement has in-app only. Plan **adds** `pushNotificationsService.sendToUser` for customer + barber, mirroring create/confirm and tips. This is additive, not a disable.

**Do not** set env `SMS_ENABLED=false` as the settlement fix — that would kill all SMS product-wide.

### R6 — Barber customers: (a) assigned-only vs (b) can create?

**Recommendation: (b)** — barbers search **only** `preferredEmployeeId = me`, but **keep** `POST /customers/quick` which already attaches `preferredEmployeeId` from the selected barber. Walk-in with no preferred barber will **not** appear in the picker (product cost of privacy). Admin search stays global.

Do **not** silently change `GET /customers` default for EMPLOYEE without `mine=1` (that would break any other caller that relies on unscoped search). Change **CustomerTypeahead** for `role=EMPLOYEE` to pass `mine=1`.

---

## A. بک‌اند (NestJS + PostgreSQL) — جزئیات فارسی

### A1. تسویه نوبت (settlement) — R1

- **فایل:** `backend/src/appointments/appointments.service.ts`  
- **تابع:** `settle()` (نه `settleAppointment` / `completeAppointment`) سپس `private notifyAppointmentSettled()`  
- **کنترلر:** `backend/src/appointments/appointments.controller.ts` → `POST :id/settle`  
- **یوتیل:** `backend/src/appointments/settlement-notify.util.ts` (`settlementBarberNotifyKeys`, مبالغ تومان)  
- **SMS:** `SmsOutboundService.sendIfAllowed` + قالب `SMS_TEMPLATE_KEYS.APPOINTMENT_SETTLED_BARBER` + رویداد `SMS_EVENT_KEYS.APPOINTMENT_SETTLED` (`appointment.settled`)  
- **رفتار فعلی:** بعد از commit، نوتیف in-app برای مشتری و آرایشگر + **SMS به آرایشگر** (و در صورت اجازه سیاست، CC به شماره‌های always-CC). Web Push در این متد **نیست**.  
- **رفتار مطلوب:** همان in-app + Socket.IO؛ **حذف SMS**؛ **افزودن Web Push** برای مشتری و آرایشگر (مثل مسیر تأیید نوبت ~2276 و انعام).  
- **کامنت اجباری روی محل حذف SMS:**

```ts
// [REQ-1] settlement SMS intentionally disabled — in-app & Web Push only.
// Admin can re-enable in future via sms_notification_rules (not by resurrecting this call).
```

- **Seeds/policy:** `backend/src/sms/sms-event-keys.ts` (`DEFAULT_SMS_POLICY`) + `backend/src/sms/sms-notification-policy.service.ts` `ensureDefaults()`.  
- **تست:** `sms-template.catalog.spec.ts` و `sms-notification-policy.spec.ts` امروز انتظار `smsEnabled: true` برای settlement دارند → باید `false` و «sendIfAllowed صدا نشود». اگر تست واحد روی `AppointmentsService.settle` نیست، یک spec متمرکز با mock `SmsOutboundService` اضافه شود.  
- **حفظ:** `NotificationsService.create` را حذف نکنید.

### A2. انعام (TIP_RECEIVED) — R2

- **فایل سرویس:** `backend/src/sms/tip-alert.service.ts` — `notifyTipRecipients`  
- **ماژول:** `backend/src/sms/tip-alert.module.ts` (صریحاً: SMS ارسال نمی‌شود)  
- **نوتیف:** `NotificationsService.create` با `NotificationType.TIP_RECEIVED`  
- **گیت‌وی:** `NotificationsGateway.sendToUser`  
- **پوش:** `PushNotificationsService.sendToUser`  
- **فراخوان‌ها:**  
  - `appointments.service.ts` بعد از settle (~1618–1637)  
  - `admin/admin-tips.service.ts` بعد از ثبت دستی (~269)  
- **تأیید SMS:** هیچ import از `SmsOutboundService` در `TipAlertService` نیست. سیاست `tip.received` پیش‌فرض false و در `ensureDefaults` **هر بار false می‌شود**.  
- **گیرنده نوتیف:** هر `employeeId` داخل `allocations` (پرسنل خدمات انتخاب‌شده، نه لزوماً آرایشگر نوبت). ادمین در این حلقه نیست.  
- **Parking-lot:** اگر بعداً SMS انعام خواسته شد، فقط از مسیر سیاست + فراخوان صریح — الان انجام نشود.  
- **کار این تسک:** لاگ تأیید در کد لوکال؛ چک پروداکشن جدا و read-only.

### A3. حقوق کارمند / برداشت‌ها — R3

- **لیست تاریخچه کارمند (باگ اصلی فیلتر):**  
  - کنترلر: `backend/src/employees/employee-salary-request.controller.ts` — `GET withdrawals`  
  - سرویس: `backend/src/admin/employee-salary-request.service.ts` — `listMyWithdrawals` (~512)  
  - کوئری فعلی: `transactions` با `deletedAt: null`, `type: EXPENSE`, `employeeId`؛ مرتب‌سازی `occurredAt desc`  
  - **`from`/`to` وجود ندارد** — فرانت تاریخ را برای preview می‌فرستد، نه برای این جدول.  
- **فیلتر درست:** Jalali `from`/`to` را با همان `jalaliToUtcRange` / مرز تهران (از `employee-salary.service.ts` یا `tehran-business-day.ts`) به `Date` تبدیل کنید و روی **`occurredAt`** اعمال کنید: `{ gte: start, lte: end }` برای **همین لیست** (نه تغییر `gt` در preview حقوق).  
- **`createdAt` را برای فیلتر کسب‌وکار استفاده نکنید** — فیلد کسب‌وکار `occurredAt` است.  
- **نباید** `netPayable` / `findPriorWithdrawals` / commit تسویه را عوض کند.  
- **ادمین «برداشت‌های دوره»:** از قبل با preview فیلتر می‌شود. کار UI: دکمه «ماه جاری» روی `frontend/src/app/dashboard/admin/employee-salary/page.tsx` (الان فقط دو DatePicker است).  
- **کارمند «ماه جاری»:** در `salary-request/page.tsx` دکمه هست ولی `getCurrentJalaliDate` (TZ مرورگر) و `to = today`؛ و **به `loadWithdrawals` پاس داده نمی‌شود**. فیکس: `getTehranTodayJalali()` + پاس `from`/`to` به API + پیش‌فرض ماه جاری هنگام mount.  
- **Swagger `@ApiQuery`:** اگر پروژه روی این کنترلر Swagger دارد اضافه شود؛ الزام عملکرد نیست.

---

## 10. Per-requirement implementation plan (English, executable)

### R1 — Settlement SMS → in-app + push

**Task interpretation:** Cost/policy change: do not SMS on settle. Keep notification UX. Add push so barbers without the dashboard open still get a ping.

**Evidence locations:** `appointments.service.ts` 1612–1616, 2378–2456; `sms-event-keys.ts` 67–70; `sms-outbound.service.ts`; `sms-notification-policy.service.ts` 26–41.

**Local vs server:** Local only until approved. Prod still `SMS_ENABLED=true`; after deploy, settlement SMS must stay off even if env stays true.

**Risks:** Admin SMS UI can re-enable `appointment.settled` unless `ensureDefaults` force-off **and** the call is gone. Push requires existing subscription (same as tips). Always-CC for settlement stops automatically.

**Safe plan:**

1. Remove `sendIfAllowed` block; leave comment `[REQ-1]`. Keep `dedupeKey` unused or only for in-app `relatedEntity`.  
2. After in-app create, `pushNotificationsService.sendToUser` for customer and barber (guard missing `userId`).  
3. Default + force-off policy. Update specs.  
4. Do not change `settle()` ledger.

**Validation:** Jest: `sendIfAllowed` not called; `notifications.create` still called; `push.sendToUser` called when userId present. No live SMS.

**Rollback:** Restore the `sendIfAllowed` block; revert policy default. No DB rollback.

**Unknowns:** Whether product still wants customer in-app (keep yes). Whether barber push copy should use net تومان (yes, reuse `resolveSettlementToman`).

---

### R2 — Tip verification

**Task interpretation:** Confirm-only.

**Evidence:** `tip-alert.service.ts` entire file; spec `sends in-app + socket + push and never SMS`.

**Plan:** No code. Optional later: document in this file after a read-only prod grep.

**Rollback:** N/A.

---

### R3 — Withdrawals date filter + «ماه جاری»

**Task interpretation:** Employee table ignores dates. Admin lacks current-month preset. Default range = current Jalali month (1st → today in Tehran).

**Evidence:** `listMyWithdrawals`; employee page `loadWithdrawals` params `{ page, limit }` only; admin page DatePickers without preset.

**Risks:** Using `gt` on the **list** is optional; prefer **`gte`/`lte` inclusive** for a history filter (this is display, not payroll). Do **not** change preview `gt` without a separate financial sign-off. 90-day cap applies to **preview**, not necessarily to history — if we add a cap, document it; recommendation: same 90-day max as preview to avoid heavy scans, or no cap with pagination (already paginated).

**Safe plan:**

1. Add optional `from`,`to` Jalali query to `GET /employees/me/withdrawals`.  
2. Reuse digit-normalize + Tehran day bounds; `occurredAt: { gte, lte }`; keep `deletedAt: null`.  
3. Frontend employee: on load `setCurrentMonthRange` using `getTehranTodayJalali`; pass dates into `loadWithdrawals`; «ماه جاری» also reloads table.  
4. Frontend admin: same preset button filling `fromDate`/`toDate` (does not auto-preview until user clicks پیش‌نمایش — or auto-preview; prefer fill only to avoid surprise commits). Default empty until user picks, **or** default current month on admin too — product: **default current month on both pages**.

**Validation:** Request with `from=1404/06/01&to=1404/06/31` returns only rows in that Tehran window. Empty/invalid dates: 400 or ignore (prefer 400 if one side missing). Payroll preview totals unchanged (no code path shared except date util).

**Rollback:** Revert query params; UI still works without them (backend treats missing as unfiltered — **or** require dates; safer: optional params, UI always sends them).

**Unknowns:** End of month vs today for «ماه جاری». This plan: **1st → today (Tehran)**, matching existing employee button semantics.

---

### R4 — `appointmentCount` + dual-axis chart

**Task interpretation:** Monthly sales chart should show volume and مبلغ. Amount already exists as `revenue.total`. Add count.

**Evidence:** `admin-financial.service.ts` `getMonthlyRevenueTotal` / `getMonthlyRevenueByEmployee`; UI Chart 2 uses `total` amount. `YearlyReportMonth` has no `appointmentCount`.

**Count definition (locked):** same filter as revenue amount — **not** `status = COMPLETED` only, **not** `createdAt`:

```
status IN (COMPLETED, PAID, SETTLED)
deletedAt IS NULL
paidAt NOT NULL AND paidAt in Jalali month range (existing start/end)
```

That matches «مبلغ فروش» already shown. Using only `COMPLETED` would **diverge** from the amount series.

**No** `user.barbershopId` — single salon.

**Security:** endpoint already `@Roles('ADMIN')` + `FinancialReportsAccessGuard`. Count is an aggregate, not row leak.

**Frontend:** `frontend/src/app/dashboard/admin/financial/page.tsx` — second series `appointmentCount`, `yAxisId="count"`, label `حجم نوبت`. Amount axis stays تومان formatter (`/10`). **Do not** extend dead `monthly-chart.tsx`.

**Performance:** one extra `prisma.appointment.count` per month inside the existing `Promise.all` (12 extra counts). Acceptable. Alternatively `_count` from the existing `groupBy` sum of employee counts — must include appointments with `employeeId` null if any; dedicated `count` is safer.

**Validation:** For a known month, `appointmentCount` equals SQL count with the same where. Dual axis readable.

**Rollback:** Remove field; old clients ignore extra JSON.

**Unknowns:** Whether Chart 3/4 (yearly ranking) also need a monthly dual chart — this plan only Chart 2.

---

### R5 — Services most-used first

**Task interpretation:** Admin/barber `AppointmentForm` uses unsorted `GET /services`. Public booking already sorted.

**Evidence:** `services.service.ts` `findAll` vs `findAllPublic`; `AppointmentForm.loadServices` → `/services`; pivot `AppointmentService`.

**Safe plan:**

1. `findAll({ sort?: 'usage' })`. Default for authenticated list used by appointment form: **usage**. Other admin service-management screens: keep `createdAt desc` unless they share the same GET — **check callers**.  
   Callers of `GET /services`: `AppointmentForm`, `admin/appointments/new`, possibly services admin page.  
2. If services admin page would break (expects newest first), use `?sort=usage` only from `AppointmentForm`.  
3. Count: `appointment_services` JOIN `appointments` WHERE `appointments.deletedAt IS NULL`. Do **not** count soft-deleted appointments. `Service` has no `deletedAt`.  
4. Prefer Prisma `groupBy` / `_count` on `appointmentServices` over JSON `@>`. Exclude deleted appointments via relation filter.

**Validation:** Most-booked service appears first on admin create form. Public endpoint unchanged unless we later unify.

**Rollback:** Remove query param; restore `createdAt desc`.

**Risks:** Heavy count on every form open — index already on appointment `deletedAt`; unique `(appointmentId, serviceId)`. If slow, cache later; not v1.

---

### R6 — Barber customer picker scope

**Task interpretation:** Privacy on **appointment customer search**, not the whole customers module.

**Evidence:** `customers.controller.ts` `resolveScopedPreferredEmployeeId` — EMPLOYEE scoped **only** if `mine=1` / `preferredEmployeeId=me`. Comment: appointment search left unscoped. `CustomerTypeahead` does not pass `mine`. Column: **`preferredEmployeeId`**, not `barberId` / `clientOfId`.

**Safe plan:**

1. `AppointmentForm` when `role === 'EMPLOYEE'`: `CustomerTypeahead` search params `{ search, mine: '1' }`.  
2. Admin: no `mine`.  
3. Keep quick-create attaching preferred barber.  
4. Do not default-scope `GET /customers` without query (breaks other tools).  
5. `searchCustomers` post-filter already supports scopedId.

**Validation:** Employee JWT cannot see another barber’s preferred customers in typeahead. Admin still sees all. `GET /customers/:id` IDOR is **pre-existing** — out of scope unless you explicitly expand.

**Rollback:** Stop sending `mine=1`.

**Risks:** High (ACL). Walk-in customers with `preferredEmployeeId = null` hidden from barber picker. That is accepted under recommendation (b).

---

### R7 — Admin customer row shows barber name

**Task interpretation:** Identity context in admin appointment create.

**Evidence:** `searchCustomers` already `include: { preferredEmployee: { user: true } }`. Typeahead interface omits it. Render: `نام — {preferredEmployee.user.name ?? 'تیم سالن'} (phone)`.

**No backend change** unless we want a dedicated DTO field `preferredEmployeeName` (optional sugar).

**Validation:** Two customers with the same name distinguishable by barber + phone.

**Rollback:** Revert label JSX.

---

## 11. What we will not do (prompt noise rejected)

| Invented idea | Reality |
|---------------|---------|
| `tenantId` / `barbershopId` on every query | Not in schema; single salon |
| `backend/src/features/appointments` | Use `backend/src/appointments` |
| Filter withdrawals on `createdAt` | Use `occurredAt` |
| Change payroll `gt` to `gte` in this batch | Separate financial sign-off |
| Count R4 with `status=COMPLETED` only | Match revenue `SETTLED` statuses + `paidAt` |
| Fix `monthly-chart.tsx` `/accounting/monthly-chart` | Dead route |
| Wrap notify inside settle `$transaction` | Must stay post-commit soft-fail |
| Disable global always-CC | Only settlement call removal |
| Mass-update production `sms_notification_rules` via SQL | Use `ensureDefaults` + code removal |
| New Prisma migration | Not needed |

---

## 12. Test plan (local)

| Req | Test |
|-----|------|
| R1 | Unit: settle notify path — `smsOutbound.sendIfAllowed` **not** called; `notifications.create` called; `push.sendToUser` called. Policy spec: `appointment.settled` default false. **No e2e that sends real SMS.** |
| R2 | Existing `tip-alert.service.spec.ts` — already asserts no SMS. Re-run only. |
| R3 | Unit/service: `listMyWithdrawals` with from/to excludes outside `occurredAt`. UI: ماه جاری fills Tehran month start→today and refetches. |
| R4 | `getYearlyReport` month has `appointmentCount` matching Prisma count. No customer row payload. |
| R5 | `findAll({ sort: 'usage' })` order; deleted appointments excluded. |
| R6 | Controller: EMPLOYEE + `mine=1` filters `preferredEmployeeId`; EMPLOYEE without mine unchanged; ADMIN unscoped. **E2E customer search** if timeboxed; otherwise unit on `resolveScopedPreferredEmployeeId` + typeahead param. |
| R7 | Component/render: label contains barber name or «تیم سالن». |

Do not run `npm test` against production DB. Prefer `.env.testing` / Nest testing module / mocked Prisma. **Do not open `.env` files to copy secrets.**

---

## 13. Commit / release strategy (after implementation approval)

Local commits **only if the owner asks**. Suggested split (not done now):

1. `fix(notify): disable settlement SMS; keep in-app; add push`  
2. `fix(salary): pass Jalali from/to to employee withdrawals`  
3. `feat(salary): current-month preset on admin + employee`  
4. `feat(financial): monthly appointmentCount dual-axis`  
5. `feat(services): sort GET /services by usage`  
6. `fix(customers): scope barber appointment typeahead with mine=1`  
7. `feat(appointments): show preferred barber on admin customer picker`

No bump / no prod until: local tests pass, this plan’s validation, **and** explicit deploy approval. Semver bump is a **later** release-manager step.

---

## 14. Risks and weaknesses

- Production source drift: implementing locally does not fix live SMS until a full release.  
- R1 force-off on boot overrides an admin who turned settlement SMS **on** — that is intended once product confirms SMS is not a contractual right.  
- R3 inclusive `gte` on history vs exclusive `gt` on payroll can make the table and the preview **disagree** by midnight-stamped rows — document, do not “fix” payroll in the same PR.  
- R5 JSON vs pivot count mismatch if historical rows lack `appointment_services`.  
- R6 hides salon-team customers from barbers.  
- Dual-axis charts misread if units unlabeled.

---

## 15. Unknowns / need verification

1. Owner confirmation of R1 two-layer policy + keep global always-CC.  
2. Owner confirmation of R6 option (b).  
3. Whether services **management** page shares `GET /services` and must stay newest-first (`sort=usage` opt-in).  
4. Production: is `TipAlertService` deployed? (read-only later)  
5. Whether any appointment lacks `appointment_services` rows (R5 accuracy).

---

## 16. Recommended next step

1. Owner answers the two red lines (R1 policy + R6 b).  
2. If yes: implement **local only**, R1 → R3 → R4 → R5 → R7 → R6 (R6 last because ACL).  
3. Do **not** deploy. After local green, produce a separate production blast-radius note from `doocard-prod-path-registry.md` + `ip.txt`.

### Execution-ready Cursor prompt (only after confirmation)

```text
Implement locally only (no prod, no migrate, no .env reads). Workspace C:\scooch\Versions\v.2.0.4.

R1: In backend/src/appointments/appointments.service.ts notifyAppointmentSettled, remove smsOutbound.sendIfAllowed; keep notificationsService.create + gateway.sendToUser; add pushNotificationsService.sendToUser for customer and barber. Comment [REQ-1]. Set appointment.settled smsEnabled false in DEFAULT_SMS_POLICY and force-off in ensureDefaults like TIP_RECEIVED. Update sms-notification-policy.spec.ts and sms-template.catalog.spec.ts. Do not disable SMS_ALWAYS_CC globally. Do not wrap notify in the settle transaction.

R2: no code.

R3: Add optional Jalali from/to to GET /employees/me/withdrawals; filter transactions.occurredAt with Tehran gte/lte; deletedAt null. Do not change findPriorWithdrawals. Frontend salary-request: pass from/to; default and «ماه جاری» via getTehranTodayJalali (month start → today). Admin employee-salary page: add «ماه جاری» preset only.

R4: AdminFinancialService yearly months add appointmentCount using the same where as getMonthlyRevenueTotal. Dual-axis on frontend/src/app/dashboard/admin/financial/page.tsx. Ignore monthly-chart.tsx.

R5: GET /services?sort=usage counts appointment_services where appointment.deletedAt is null. AppointmentForm requests sort=usage. Do not change findAllPublic unless needed.

R6: CustomerTypeahead for EMPLOYEE passes mine=1. Admin does not. Keep quick create.

R7: Typeahead result label includes preferredEmployee.user.name or تیم سالن.

No secrets, no SMS in tests, no schema migration, no tenantId.
```

---

## 17. Rollback plan (once implemented)

| Req | Rollback |
|-----|----------|
| R1 | Git revert notify + policy files; no DB migrate |
| R2 | N/A |
| R3 | Revert controller/service/UI; list becomes unfiltered again |
| R4 | Extra JSON field ignored by old UI; revert UI+service |
| R5 | Revert sort query |
| R6 | Stop sending `mine=1` |
| R7 | Revert JSX |

---

*End of architecture plan. Implementation starts only after explicit owner approval of this document and the two red-line answers.*
