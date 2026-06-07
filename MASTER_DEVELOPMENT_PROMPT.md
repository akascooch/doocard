# Doocard Barbershop Platform — MASTER DEVELOPMENT PROMPT

**Purpose:** Single source of truth for roles, permissions, business domains, rules, and boundaries.  
**Usage:** Reference this document when defining or changing behavior.  
**Analysis mode:** Read-only extraction; no refactors or assumptions.

---

## 1. User Roles & Permissions

### 1.1 Where roles are defined

| Location | Content |
|----------|--------|
| **DB (source of truth)** | `backend/prisma/schema.prisma` — `enum UserRole { ADMIN, MANAGER, EMPLOYEE, CUSTOMER, ACCOUNTANT }` |
| **Backend TypeScript** | `backend/src/common/enums.ts` — `Role`: ADMIN, EMPLOYEE, CUSTOMER only (no MANAGER, no ACCOUNTANT) |
| **Backend auth** | `backend/src/auth/role.enum.ts` — same as common/enums (ADMIN, EMPLOYEE, CUSTOMER) |
| **Guards** | `backend/src/common/guards/roles.guard.ts`, `backend/src/auth/guards/roles.guard.ts`, `backend/src/common/guards/permission.guard.ts` — all read `user.role` from request and compare to `@Roles(...)` metadata |

**Explicit inconsistency:** Prisma `UserRole` has five values (ADMIN, MANAGER, EMPLOYEE, CUSTOMER, ACCOUNTANT). Backend enums and most controllers use three (ADMIN, EMPLOYEE, CUSTOMER). Controllers that need ACCOUNTANT use the string `'ACCOUNTANT'` in `@Roles('ADMIN', 'ACCOUNTANT')`. Frontend and `permissions.service.ts` refer to **BARBER** (not in Prisma); permissions reset defaults use role key `BARBER` for barber-like access.

### 1.2 Role-to-capability matrix (from controller guards and service checks)

| Role | Can do | Cannot do |
|------|--------|-----------|
| **ADMIN** | All: create/update/delete appointments, settle payments, manage employees, services, customers, users, accounting, day-closing, blocked times, settings, import; soft-delete appointments; confirm appointments. | — |
| **MANAGER** | Defined in DB only; used in SMS processor for “notify managers.” No controller explicitly allows MANAGER. | Effectively same as EMPLOYEE unless a controller adds MANAGER. |
| **EMPLOYEE** | Create/read/update appointments (not delete); list/find customers and employees; confirm appointments; cancel own appointments; view own calendar and blocked times; dashboard stats; accounting read; day-closing read by date. | Settle appointments; delete appointments; create/delete blocked times; create/update/delete employees or services; close/reopen day; create transactions; manage users. |
| **CUSTOMER** | Register (with role CUSTOMER); create appointments (status PENDING_CONFIRMATION); list/find own appointments; cancel own appointments; get own profile (customers/me, customers/me/profile); update own customer record if backend allows by resource ownership. | Confirm appointments; settle; update/delete others’ appointments; access other customers’ data; manage employees, services, accounting, users. |
| **ACCOUNTANT** | Settle appointments (POST appointments/:id/settle); full accounting (transactions, accounts, categories, transfers) create/update/delete; same accounting read as EMPLOYEE. | Not used in dashboard/sidebar by role name; frontend does not show “ACCOUNTANT” in role badge (only ADMIN, EMPLOYEE, CUSTOMER). |

### 1.3 Permissions table (granular)

- **Model:** `backend/prisma/schema.prisma` — `Permission`: `role`, `userId?`, `page`, `feature`, `canView`, `canEdit`, `canDelete`, `canCreate`.
- **Service:** `backend/src/permissions/permissions.service.ts` — `getPermissionsByUser(userId)` merges role-based and user-specific permissions (user overrides role). Pages/features: dashboard, appointments, customers, barbers, services, accounting, users, settings, sms, permissions.
- **Default role permissions** (in `resetToDefaultPermissions`): ADMIN full; BARBER view-only dashboard, view+create+edit appointments/customers, view barbers/services/accounting; CUSTOMER view dashboard/appointments/customers/barbers/services, create appointments. **Note:** Role key is BARBER, not EMPLOYEE; Prisma has no BARBER.
- **Permissions API:** `backend/src/permissions/permissions.controller.ts` — no `UseGuards` on controller; **PermissionsModule is commented out in `app.module.ts`**, so `/api/permissions/*` (including `GET /permissions/user/me/summary`) is **not registered** in the current app. Frontend `usePermissions` calls `/permissions/user/me/summary` and will get 404 unless the module is enabled.

### 1.4 Frontend role usage

- **Navigation:** `frontend/src/components/RoleBasedSidebar.tsx` — menu items by `userRole`: ADMIN, EMPLOYEE, CUSTOMER. No MANAGER, ACCOUNTANT, or BARBER in sidebar routing.
- **Permission UI:** `frontend/src/lib/use-permissions.ts`, `frontend/src/components/ui/permission-gate.tsx` — `hasPermission(page, feature)` from backend summary; if PermissionsModule is disabled, permissions never load and gates fall back to “no permission.”
- **User creation/editing:** `frontend/src/app/dashboard/admin/users/new/page.tsx` and `[id]/edit/page.tsx` — role options include **BARBER** (label “آرایشگر”). Backend `User` creation uses Prisma `UserRole`; BARBER is not a valid enum value in DB.

---

## 2. Core Business Domains

### 2.1 Appointments / reservations

- **Source of truth:** `backend/src/appointments/appointments.service.ts`, `backend/prisma/schema.prisma` (model `Appointment`).
- **Purpose:** Book and manage customer appointments (multi-service), with optional employee, calendar date, and financial settlement.
- **Key rules enforced in backend:**
  - **Create:** Either `(jalaliDate + time)` or `scheduledAt` (ISO); Iran timezone UTC+3:30 for jalali. Customer and services required; employee optional. If employee present: employee must be able to perform at least one requested service (`EmployeeService`). Slot conflict check with **PostgreSQL advisory lock** per employee (`pg_advisory_xact_lock(hashtext('employee:'||employeeId))`). Overlap: no other non-CANCELLED, non-deleted appointment for same employee in [scheduledAt, scheduledAt+duration]. Blocked times for employee checked; if overlap with BlockedTime, creation rejected. Initial status: CUSTOMER → PENDING_CONFIRMATION; ADMIN/EMPLOYEE → PENDING.
  - **Duration:** Sum of service durations (each rounded up to nearest hour for slot math); optional `durationMin` in DTO can override. Stored in `Appointment.durationMin`.
  - **Price:** Per-service `priceAtBooking` (RIAL) from DTO or default `Math.floor(service.price * 10)` (service.price likely Toman). Stored in `Appointment.services` JSON and optionally in `amount`/`tipAmount` after settlement.
  - **Update:** Overlap re-checked only if employee or time or duration changed; same overlap logic as create (exclude current appointment id).
  - **Remove:** Soft delete (`deletedAt`). Not allowed if status is SETTLED or PAID.
  - **Cancel:** Status → CANCELLED. CUSTOMER/EMPLOYEE may only cancel own (by customerId/employeeId). Not allowed if SETTLED or PAID.
  - **Confirm:** Only from PENDING_CONFIRMATION or PENDING; re-runs overlap check under transaction with advisory lock; on conflict returns 409 with alternative slot suggestions (up to 3). Status → CONFIRMED.
  - **Settle:** ADMIN or ACCOUNTANT only. Creates INCOME transaction(s), optional tip transaction, updates BankAccount balance; or creates CustomerDebt if paymentMethod is DEBT. Idempotency via `externalRef` in transaction meta. Appointment status → SETTLED.

**Files:** `appointments.controller.ts` (guards + roles), `appointments.service.ts`, DTOs in `appointments/dto/`, Prisma `Appointment`, `AppointmentService`, `WorkSchedule`, `BlockedTime`, `CalendarDate`.

### 2.2 Services (pricing, duration)

- **Source of truth:** `backend/src/services/services.service.ts`, Prisma `Service`.
- **Purpose:** CRUD for services (name, description, durationMinutes, price). Price/duration are used when building appointment service snapshots.
- **Key rules:** Service has `durationMinutes` and `price`. Deletion rejected if any `AppointmentService` references the service. Public list endpoint (`GET /services/public`) returns services with usage count (no auth). Create/update/delete require ADMIN (via RolesGuard + Role.ADMIN).

**Files:** `services.service.ts`, `services.controller.ts`, `create-service.dto.ts`, `update-service.dto.ts`.

### 2.3 Barbers / staff (employees)

- **Source of truth:** `backend/src/employees/employees.service.ts`, Prisma `Employee`, `EmployeeService`, `WorkSchedule`, `BlockedTime`.
- **Purpose:** Employees (barbers) linked to User; optional baseSalary, commissionRate; assignment of services they can perform; work schedules and blocked times.
- **Key rules:** Create employee (ADMIN only) creates User + Employee. Employee can have `isDefault`, `isActive`. Assign services via `EmployeeService` (unique employeeId+serviceId). WorkSchedule: weekday, startTime/endTime (HH:MM). BlockedTime: startAt/endAt (UTC). Slots and conflict checks use these.

**Files:** `employees.controller.ts`, `employees.service.ts`, Prisma `Employee`, `EmployeeService`, `WorkSchedule`, `BlockedTime`.

### 2.4 Customers

- **Source of truth:** `backend/src/customers/customers.service.ts`, Prisma `Customer`, `User`.
- **Purpose:** Customer profile linked to User; optional preferredEmployee; used in appointments and debts.
- **Key rules:** Create (ADMIN/EMPLOYEE) creates User (role CUSTOMER) + Customer; phone unique. Preferred employee resolved from DTO or default/first active employee. findOne: controller allows ADMIN, EMPLOYEE, CUSTOMER; for CUSTOMER it compares `currentUser.id !== id` — **id here is customer id (from URL), not user id**; so the check is wrong (user id vs customer id), creating an authorization bug. getMyProfile(userId) correctly finds customer by userId.

**Files:** `customers.controller.ts`, `customers.service.ts`, Prisma `Customer`.

### 2.5 Payments / accounting

- **Source of truth:** `backend/src/accounting/accounting.service.ts`, Prisma `Transaction`, `BankAccount`, `TransactionCategory`, `CustomerDebt`, and appointment settlement in `appointments.service.ts`.
- **Purpose:** Record income/expense/transfer, manage bank accounts and categories; settle appointments (payment or debt); optional tips.
- **Key rules:** Transactions store amount in RIAL (BigInt). Settlement creates INCOME (+ optional TIP), updates account balance, or creates CustomerDebt. Transfers use destinationAccountId. Role: ADMIN/ACCOUNTANT create/update/delete; ADMIN/ACCOUNTANT/EMPLOYEE read. Salary and day-closing are separate (salary.service, day-closing.service).

**Files:** `accounting.service.ts`, `accounting.controller.ts`, `appointments.service.ts` (settle), Prisma models above.

### 2.6 Commissions / revenue split

- **Source of truth:** `backend/src/accounting/salary.service.ts`, Prisma `Employee` (commissionRate, baseSalary), `Appointment`, `Tip`.
- **Purpose:** Calculate employee salary for a period: baseSalary + commission on appointment revenue + tips.
- **Key rules:** Salary calculation uses appointments with status IN ['COMPLETED','SETTLED','PAID'] in date range; service revenue from appointment.amount; commission = serviceRevenue * (employee.commissionRate/100); tips from Tip table for employee in range. No automatic payout; Salary records created with status PENDING, then paid (status PAID) via service.

**Files:** `salary.service.ts`, `salary.controller.ts`, Prisma `Salary`, `Tip`.

### 2.7 Notifications

- **Source of truth:** `backend/src/notifications/notifications.service.ts`, `notifications.gateway.ts`, `backend/src/push-notifications/push-notifications.service.ts`, Prisma `Notification`.
- **Purpose:** In-app notifications (Notification model, WebSocket by role/user) and push notifications (PushSubscription, send to role or user).
- **Key rules:** Notification has type (e.g. APPOINTMENT_CREATED, APPOINTMENT_CONFIRMED), roleTarget or userIdTarget. Appointment lifecycle (create, confirm, settle, cancel) triggers notifications to ADMIN, assigned employee, and customer. SMS queued separately (Bull queue) for appointment reminders.

**Files:** `notifications.service.ts`, `notifications.controller.ts`, `notifications.gateway.ts`, `push-notifications.service.ts`, `appointments.service.ts` (notify* helpers).

### 2.8 Auth & identity

- **Source of truth:** `backend/src/auth/auth.service.ts`, `auth.controller.ts`, JWT strategy, Prisma `User`, `RefreshToken`.
- **Purpose:** Login (phone/email + password), refresh token (cookie), logout; register (creates User + role-specific profile).
- **Key rules:** Register accepts `role` (string, no enum validation in RegisterDto); creates User then, if role CUSTOMER, creates Customer (with optional preferredEmployeeId). No server-side restriction on which role can be registered — frontend sends role. JWT payload: sub (user id), email, phone, role. validate() returns `{ id: payload.sub, email, phone, role }` (req.user.id is user id). Login sets refresh_token and token in cookies.

**Files:** `auth.service.ts`, `auth.controller.ts`, `strategies/jwt.strategy.ts`, `guards/jwt-auth.guard.ts`, `register.dto.ts`.

---

## 3. Critical Business Rules

- **Time conflicts:** For a given employee, no two non-CANCELLED, non-deleted appointments may overlap in time. Overlap: [startA, endA) ∩ [startB, endB) non-empty. Enforced on create (inside transaction with advisory lock) and on update when employee/time/duration change; also on confirm with lock and conflict → 409 with suggestions.
- **Blocked times:** If appointment window intersects any BlockedTime for the employee, create/update is rejected with message including reason.
- **Cancellation:** Only own appointments (CUSTOMER by customerId, EMPLOYEE by employeeId). Cannot cancel if status is SETTLED or PAID.
- **Soft delete:** Appointments are soft-deleted (deletedAt). Remove (soft delete) forbidden if status SETTLED or PAID.
- **Walk-in:** No explicit “walk-in” flag; any appointment can be created with PENDING and then settled. Slot conflict still applies when employee is set.
- **Overbooking protection:** Advisory lock + overlap check inside same transaction; no double-booking for same employee.
- **Settlement idempotency:** If `SettleAppointmentDto.externalRef` is provided and a transaction with same externalRef exists, settle returns existing state without creating duplicate.
- **Price at booking:** Backend accepts optional `priceAtBooking` per service; otherwise uses `Math.floor(service.price * 10)` (RIAL). Frontend must not trust client-calculated totals for authority; backend recalculates from services snapshot.
- **Duration:** Backend computes total from service durations (rounded up to hour for slotting) or uses dto.durationMin; frontend can send duration but backend is authoritative.

---

## 4. Frontend Responsibility Boundaries

- **Frontend may calculate for UX only:** Slot list is from backend `GET /appointments/slots`; frontend can display and filter. Display of totals/prices in RIAL or Toman is presentation only.
- **Frontend only displays:** Appointment status, customer/employee names, dates/times, amounts after load from API. Permission-based visibility (e.g. PermissionGate) is best-effort; backend enforces.
- **Frontend is forbidden to decide:** Final slot availability (backend reserves with lock); overlap validity; cancellation eligibility (own + not SETTLED/PAID); settlement (who can settle, amount, account); role-based access to endpoints; whether a user can confirm/cancel/update a given appointment.

---

## 5. Backend Authority

- **Guards:** `JwtAuthGuard` (validates JWT, sets req.user). `RolesGuard` (common) / `roles.guard` (auth): allow if `user.role` is in `@Roles(...)`. `PermissionGuard` (common): same role check from 'roles' metadata. Controllers use `@UseGuards(JwtAuthGuard, PermissionGuard)` or `JwtAuthGuard` + `RolesGuard`; some use `@Public()` for slots, public services, public employees.
- **Validation pipes:** Global `ValidationPipe` in `main.ts`: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. DTOs use class-validator (IsNumber, IsEnum, IsDateString, etc.). Appointment status enum in DTOs: `AppointmentStatusEnum`; payment method: `SettlePaymentMethod`; transaction type: Prisma `TransactionType`.
- **Prisma constraints:** Unique (User.phone, RefreshToken.token, PushSubscription.endpoint, EmployeeService/AppointmentService composites, WorkSchedule composite); foreign keys with onDelete (Cascade, SetNull). No DB-level check that appointment times do not overlap; enforced in service with lock.
- **Transactions:** Used for: appointment create (lock + overlap + blocked check + insert + notify); appointment confirm (lock + overlap check + update); appointment settle (update appointment + create transaction(s) + update balance or debt); auth register (user + customer); permissions setBulk/setUserPermissions; accounting create/update/transfer; salary pay; employee assignServices; customer update (with user update). Advisory lock only in appointments (per-employee).

---

## 6. Known Coupling / Risk Areas

- **Role enum mismatch:** Prisma has ADMIN, MANAGER, EMPLOYEE, CUSTOMER, ACCOUNTANT. Backend enums and sidebar use ADMIN, EMPLOYEE, CUSTOMER. Frontend and permissions.service use BARBER; Prisma has no BARBER. MANAGER used only in SMS. Align enums and role names (backend vs DB vs frontend) to avoid 403 or wrong access.
- **Customer findOne authorization:** In `customers.controller.ts`, CUSTOMER is allowed to call findOne(id) but check is `currentUser.id !== id`. Param `id` is customer id; `currentUser.id` is user id. Should resolve customer by currentUser.id and allow only if that customer.id === id. Otherwise any customer can access another’s profile by customer id.
- **Permissions module disabled:** PermissionsModule is commented out in app.module. Frontend usePermissions and PermissionGate rely on `/permissions/user/me/summary`; that route does not exist. Either enable PermissionsModule and protect the controller with JWT, or remove/adapt frontend permission UI.
- **Register role:** RegisterDto.role is a string with no @IsEnum. Backend accepts any role and creates User with that role; if frontend sends BARBER or invalid value, Prisma may throw or create inconsistent state (e.g. BARBER not in UserRole enum).
- **JWT user id:** Strategy puts `id: payload.sub` on req.user. Some code uses `req.user.sub` or `req.user.userId` (e.g. permissions getCurrentUserPermissionsSummary: `req.user?.userId || req.user?.id`). Inconsistency can break permission or ownership checks.
- **Price units:** Service.price and appointment amounts: backend uses RIAL (e.g. price*10 from Toman). Frontend must not assume Toman vs RIAL; backend responses document or use consistent field names (e.g. amount in RIAL).
- **Slots endpoint public:** `GET /appointments/slots` is not protected. Anyone can query slots; no sensitive data but could be used for scraping availability.

---

**End of document. Use this for development prompts; do not refactor or change behavior from this document alone.**
