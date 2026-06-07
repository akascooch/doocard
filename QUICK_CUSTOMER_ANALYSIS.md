# STRICT PRODUCTION ANALYSIS – QUICK CUSTOMER CREATION (READ-ONLY)

**No code changes. Read-only.**

---

## 1. Backend customer creation logic

### 1) `create()` method

**File:** `backend/src/customers/customers.service.ts`

- **Entry:** `create(createCustomerDto: CreateCustomerDto)` (called by `POST /customers`).
- **Steps:**
  1. Check if a **user** with the same `phone` already exists (`prisma.user.findUnique({ where: { phone } })`).
  2. If exists → throw `ConflictException('User with this phone number already exists')`.
  3. Hash password: if `password` provided use it, else use default `'123456'`; `bcrypt.hash(..., 10)`.
  4. Create **User**: `name`, `phone`, `email` (or null), `password` (hashed), `role: 'CUSTOMER'`.
  5. Resolve **preferredEmployeeId**: from DTO, or default employee (`isDefault: true`), or first active employee.
  6. Create **Customer**: `userId`, `birthdate`, `notes`, `preferredEmployeeId`.
  7. Return created customer with `include: { user: true }`.
- **Errors:** Re-throw `ConflictException`; others wrapped in `Error('Failed to create customer: ...')`.

### 2) DTO used

**File:** `backend/src/customers/dto/create-customer.dto.ts`

| Field               | Type   | Validation      | Required |
|---------------------|--------|------------------|----------|
| name                | string | @IsString()      | yes      |
| phone               | string | @IsString()      | yes      |
| email               | string | @IsOptional(), @IsEmail() | no  |
| password            | string | @IsOptional(), @IsString() | no |
| birthdate           | string | @IsOptional(), @IsDateString() | no |
| notes               | string | @IsOptional(), @IsString() | no |
| preferredEmployeeId | number | @IsOptional(), @IsInt() | no |

No explicit format validation for `phone` (e.g. no regex like `09\d{9}`) in this DTO.

### 3) Validation rules

- Class-validator on DTO (as above).
- Backend: only duplicate-phone check before create; no phone normalization or format validation in customers service.

### 4) How user + customer are created

- **Order:** User first, then Customer.
- **User:** `prisma.user.create` with name, phone, email, password, role `'CUSTOMER'`.
- **Customer:** `prisma.customer.create` with `userId: user.id`, `birthdate`, `notes`, `preferredEmployeeId` (resolved as above).
- **Not in a single transaction** in customers.service (unlike auth register which uses `$transaction`).

### 5) Password handling logic

- If DTO has `password` → `bcrypt.hash(password, 10)`.
- If not → `bcrypt.hash('123456', 10)` (default).
- Stored in `users.password`; never returned in API (Prisma default excludes it unless selected).

### 6) Role assignment

- Always `role: 'CUSTOMER'` in `user.create` (hardcoded in customers.service).

### 7) Unique phone handling

- Before create: `prisma.user.findUnique({ where: { phone } })`.
- If found → `ConflictException('User with this phone number already exists')`.
- Phone is stored as provided; **no normalization** (no trim, no digit-only, no E.164) in customers module.

### 8) SMS logic

- **No SMS** in `customers.controller` or `customers.service`. No send-on-create, no OTP, no welcome SMS in customer creation flow.

---

## 2. Prisma User model

**File:** `backend/prisma/schema.prisma`

```prisma
model User {
  email                 String?
  password              String
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt
  id                    Int             @id @default(autoincrement())
  name                  String
  phone                 String          @unique
  role                  UserRole        @default(CUSTOMER)
  permissions           Permission[]
  customer              Customer?
  dayClosings           DayClosing[]
  employee              Employee?
  smsLogs               SmsLog[]
  createdTransactions   Transaction[]   @relation("TransactionCreator")
  paidAppointments      Appointment[]   @relation("AppointmentPaidBy")
  settledDebts          CustomerDebt[]  @relation("DebtSettledBy")
  notifications         Notification[]  @relation("UserNotifications")
  importJobs            ImportJob[]     @relation("ImportJobs")
  refreshTokens         RefreshToken[]  @relation("UserRefreshTokens")
  pushSubscriptions     PushSubscription[] @relation("UserPushSubscriptions")

  @@map("users")
}
```

- **phone:** `String` with `@unique` (DB unique constraint).
- **password:** Required (no optional).
- **role:** `UserRole` with `@default(CUSTOMER)`.
- **isActive:** Not present on User (no soft-disable flag).
- **Defaults:** `createdAt`, `updatedAt`, `role` only.

---

## 3. Prisma Customer model

**File:** `backend/prisma/schema.prisma`

```prisma
model Customer {
  id                  Int            @id @default(autoincrement())
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt
  notes               String?
  birthdate           DateTime?
  userId              Int            @unique
  appointments        Appointment[]
  debts               CustomerDebt[]
  user                User           @relation(fields: [userId], references: [id])
  preferredEmployeeId Int?
  preferredEmployee   Employee?      @relation(fields: [preferredEmployeeId], references: [id], onDelete: SetNull)
  preferredDate       DateTime?

  @@map("customers")
}
```

- **Relation with user:** `userId` → `User.id`, `@unique` (one-to-one: one user, one customer record).
- **Unique constraints:** `userId` unique (no duplicate customer per user).
- **Soft delete:** No `deletedAt` on Customer. Delete is hard delete: `customers.service.remove()` deletes customer then user (no soft delete).

---

## 4. Admin new appointment page structure

**File:** `frontend/src/app/dashboard/admin/appointments/new/page.tsx`

### 1) Customer selector component

- A **Select** (shadcn) with:
  - `value={formData.customerId}`
  - `onValueChange={(value) => setFormData({...formData, customerId: value})}`
  - Options: one `SelectItem` per customer with `value={customer.id.toString()}` and label `{customer.name} - {customer.phone}`.

### 2) How customers are fetched

- In `useEffect`: `fetchCustomers()` runs on mount.
- **Implementation:** `axios.get('/users')` then **client-side filter:** `response.data.filter((user: any) => user.role === 'CUSTOMER')`.
- So the list is **users** with role CUSTOMER, not the result of `GET /customers`. The dropdown uses **user** objects as if they were “customers” (by role).

### 3) API endpoint used

- **Endpoint:** `GET /users` (backend `UsersController.findAll()`).
- Returns users with `include: { customer: true, employee: true }` (so each user has `user.id`, `user.customer.id` if role is CUSTOMER, etc.).
- No call to `GET /customers` on this page.

### 4) How selected customerId is sent to backend

- On submit: `customerId: parseInt(formData.customerId)` is sent in the body to `POST /appointments`.
- **Important:** `formData.customerId` is the **user.id** of the selected row (because options are built from `/users` and `value={customer.id}` where `customer` is actually a user object, so `customer.id` = **user id**).
- Backend appointments expect **Customer.id** (see `appointments.service.ts`: `findUnique({ where: { id: dto.customerId } })` on **Customer**). So there is an **id mismatch**: frontend sends **User.id**, backend expects **Customer.id**. This works only when by chance a customer’s table id equals the user id (e.g. first customer).

### 5) Validation logic

- Submit: `if (!formData.customerId || !formData.employeeId || !formData.serviceId || !formData.appointmentDate || !formData.appointmentTime)` → toast “لطفاً تمام فیلدهای الزامی را پر کنید”.
- No separate validation for phone format or customer existence; backend will return 404 if `dto.customerId` does not match a real Customer.id.

---

## 5. Customer list page structure

**File:** `frontend/src/app/dashboard/admin/customers/page.tsx`

### How customers are listed

- **API:** `GET /customers` (`axios.get('/customers')`). Backend returns customers with `include: { user: true, preferredEmployee: { include: { user: true } } }`.
- **Mapping:** Each item is mapped to: `id` (customer.id), `name` (user.name), `phone` (user.phone), `email`, `birthdate`, `notes`, `createdAt`, `role: 'CUSTOMER'`, `preferredEmployeeName`, `preferredEmployeeSpecialty`.

### Fields shown in the table

- نام (name)  
- شماره موبایل (phone)  
- ایمیل (email)  
- آرایشگر (preferred employee name/specialty)  
- وضعیت (isActive – from local state, not from API)  
- تاریخ تولد (birthdate, Jalali)  
- تاریخ عضویت (createdAt, Jalali)  
- عملیات (Edit, Delete)

### Search behavior

- **Client-side filter** on `customers` (already loaded):
  - **Search:** `searchTerm` matches name (case-insensitive), phone (includes), or email (case-insensitive).
  - **Filter:** `filterStatus`: all / active / inactive (based on `customer.isActive`; API does not return `isActive` for customers, so this is effectively all/guessed).
- No server-side search query; `GET /customers` is called once without a search param. Backend does support `GET /customers?search=...` (see `customers.controller.ts`: `findAll(@Query('search') search?)` → `searchCustomers(search)` or `findAll()`), but this page does **not** use the search query.

### Create customer on this page

- **Create dialog:** Uses `axios.post('/auth/register', customerData)` with `role: 'CUSTOMER'` (not `POST /customers`). So new customers from this page are created via **auth register**, not customers.service.

---

## 6. Phone uniqueness rules

### Backend

- **Schema:** `User.phone` has `@unique` in Prisma (DB unique constraint).
- **Customers create:** `customers.service.create()` checks `prisma.user.findUnique({ where: { phone } })`; if found → `ConflictException('User with this phone number already exists')`.
- **Customers update:** Controller checks: if `updateCustomerDto.phone` is set, calls `findByPhone(updateCustomerDto.phone)`; if a customer exists with that phone and its id is not the current customer’s id, throws `Error('شماره تلفن قبلاً ثبت شده است')`. Then service updates user.phone in a transaction.
- **Auth register:** `auth.service.register()` uses `findFirst({ where: { OR: [{ phone }, { email }] } })`; if found → `ConflictException('کاربر با این شماره تلفن یا ایمیل قبلاً ثبت نام کرده است')`.
- **Users create:** `users.service.create()` uses `findUnique({ where: { phone } })`; if found → `ConflictException('شماره تلفن قبلاً ثبت شده است')`.

### Is phone normalized?

- **Customers module:** No. Phone is stored exactly as in the DTO (no trim, no digit-only, no E.164).
- **Auth/Users:** No normalization in the create/register paths used for customers.
- **SMS layer:** `FarazSmsSendService` and `sms.service.enhanced` have their own `normalizePhone` / `normalizePhoneNumber` for sending SMS only; they are **not** used when creating or updating User/Customer.

### Error when phone already exists

- **Customers:** `ConflictException('User with this phone number already exists')` (English).
- **Auth register:** `ConflictException('کاربر با این شماره تلفن یا ایمیل قبلاً ثبت نام کرده است')` (Persian).
- **Users:** `ConflictException('شماره تلفن قبلاً ثبت شده است')` (Persian).

---

## Summary table

| Topic                         | Detail |
|------------------------------|--------|
| Customer create endpoint     | `POST /customers`, DTO: name, phone, email?, password?, birthdate?, notes?, preferredEmployeeId? |
| User + Customer creation     | User first (role CUSTOMER), then Customer linked by userId; no single transaction in customers.service |
| Password                     | Optional in DTO; default `123456` if omitted; bcrypt 10 rounds |
| Role                         | Always CUSTOMER for this flow |
| Phone unique                 | DB unique on User.phone; checked in customers, auth, users before create/update |
| Phone normalization          | None in customer/user create or update |
| SMS in customer creation     | None |
| Admin new appointment        | Fetches `/users`, filters CUSTOMER, sends **user.id** as `customerId`; backend expects **Customer.id** → id mismatch risk |
| Admin customers list         | Fetches `/customers`, shows name, phone, email, preferred employee, birthdate, createdAt; search/filter client-side; create via `/auth/register` |
| Customer soft delete         | Not used; hard delete (customer then user) |

---

**DO NOT IMPLEMENT.**  
**DO NOT DEPLOY.**  
**END.**
