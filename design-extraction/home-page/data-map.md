# Data Map – Home Page Redesign

**LOCAL ONLY. NO DEPLOY.**

---

## Data Sources by Page

### Dashboard Redirect (`/dashboard/page.tsx`)

- **No API calls.** Uses only `getCurrentUser()` from `@/lib/auth` (reads from localStorage/cookies/session). No fetch, no polling, no WebSocket.

---

### Admin Home (`/dashboard/admin/page.tsx`)

| Data | Source | When | Type |
|------|--------|------|------|
| User (name, role) | `getCurrentUser()` (lib/auth) | On mount | Sync from client |
| Admin stats | `GET /api/dashboard/admin-stats` | Once in `fetchAdminData()` (useEffect) | REST, static after load |

**Fetch call:**

- **URL:** `/api/dashboard/admin-stats`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Response shape (expected):**  
  `{ totalAppointments, todayAppointments, totalCustomers, totalEmployees, monthlyRevenue, pendingAppointments, completedAppointments }`

**Displayed:**

- totalAppointments, todayAppointments (with badge “امروز”)
- monthlyRevenue (via `formatCompactMoney`)
- totalCustomers, totalEmployees
- pendingAppointments, completedAppointments
- Completion rate: `(completedAppointments / totalAppointments) * 100` (or 0 if no appointments)

**Real-time / polling / WebSocket:** None. Single fetch on mount; no refresh.

---

### Customer Home (`/dashboard/customer/page.tsx`)

| Data | Source | When | Type |
|------|--------|------|------|
| User | `getCurrentUser()` | On mount | Sync from client |
| Customer stats | `GET /api/dashboard/customer-stats` | Once (Promise.all with upcoming) | REST |
| Upcoming appointments | `GET /api/dashboard/customer-upcoming-appointments` | Once (Promise.all with stats) | REST |
| Profile (preferred employee) | `GET /api/customers/me` | Once in `fetchProfile()` | REST |

**Fetch calls:**

1. **URL:** `/api/dashboard/customer-stats`  
   **Headers:** `Authorization: Bearer <token>`  
   **Response:** `{ totalAppointments, upcomingAppointments, completedAppointments, totalSpent }` (cancelledAppointments not from API; set to 0 in code)

2. **URL:** `/api/dashboard/customer-upcoming-appointments`  
   **Headers:** `Authorization: Bearer <token>`  
   **Response:** Array of appointments; first used as “next appointment” with: id, appointmentDate, service.name, employee.user.name, status

3. **URL:** `/api/customers/me`  
   **Headers:** `Authorization: Bearer <token>`  
   **Response:** Customer profile; `preferredEmployee` (name, specialty) used in “آرایشگر من” card

**Displayed:**

- totalAppointments, upcomingAppointments, completedAppointments, cancelledAppointments (0)
- totalSpent (optional)
- nextAppointment (date via formatJalaliDateTime, service, employee, status)
- profile.preferredEmployee (name, specialty)

**Real-time / polling / WebSocket:** None. All one-time fetch on mount. After booking via BookingModal, `fetchCustomerStats()` and `fetchProfile()` are called again on success.

---

### Employee Home (`/dashboard/employee/page.tsx`)

| Data | Source | When | Type |
|------|--------|------|------|
| User | `getCurrentUser()` | On mount | Sync from client |
| Employee stats | `GET /api/dashboard/employee-stats` | Once (Promise.all with today) | REST |
| Today appointments | `GET /api/dashboard/employee-today-appointments` | Once (Promise.all with stats) | REST |

**Fetch calls:**

1. **URL:** `/api/dashboard/employee-stats`  
   **Headers:** `Authorization: Bearer <token>`  
   **Response:** `{ todayAppointments, completedAppointments, pendingAppointments, monthlyEarnings, totalCustomers, averageRating }`

2. **URL:** `/api/dashboard/employee-today-appointments`  
   **Headers:** `Authorization: Bearer <token>`  
   **Response:** Array of: id, appointmentDate, status, service { name, price, durationMinutes }, customer { user { name, phone } }  

**Displayed:**

- todayAppointments, completedAppointments (in first card subtitle)
- monthlyEarnings (toLocaleString('fa-IR') + “تومان”), hard-coded “+12% نسبت به ماه قبل”
- totalCustomers, averageRating
- List of today’s appointments (time, service, customer, duration, price, status badges, actions “تأیید نوبت” / “شروع خدمت”)

**Real-time / polling / WebSocket:** None. Single load on mount.

---

## API Route Layer (Next.js)

All dashboard APIs are Next.js route handlers that proxy to backend:

- `frontend/src/app/api/dashboard/admin-stats/route.ts` → `GET ${API_BASE_URL}/api/dashboard/admin-stats`
- `frontend/src/app/api/dashboard/customer-stats/route.ts` → `GET ${API_BASE_URL}/api/dashboard/customer-stats`
- `frontend/src/app/api/dashboard/customer-upcoming-appointments/route.ts` → `GET ${API_BASE_URL}/api/dashboard/customer-upcoming-appointments`
- `frontend/src/app/api/dashboard/employee-stats/route.ts` → `GET ${API_BASE_URL}/api/dashboard/employee-stats`
- `frontend/src/app/api/dashboard/employee-today-appointments/route.ts` → `GET ${API_BASE_URL}/api/dashboard/employee-today-appointments`

`API_BASE_URL` = `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'`. No server access or deploy implied.

---

## Summary Table

| Page | APIs Called | Real-time | Polling | WebSocket |
|------|-------------|-----------|---------|-----------|
| Dashboard redirect | None | N/A | No | No |
| Admin home | admin-stats | No | No | No |
| Customer home | customer-stats, customer-upcoming-appointments, customers/me | No | No | No |
| Employee home | employee-stats, employee-today-appointments | No | No | No |

---

## Constraints for Figma / Redesign

1. All data is **loaded once** on page open; no live updates.
2. **Loading states:** Admin/Customer/Employee show a spinner until fetch completes; design loading and empty states.
3. **Customer:** “نوبت بعدی شما” only appears when there is at least one upcoming appointment.
4. **Employee:** “نوبت‌های امروز” can be empty (empty state with icon and message).
5. **Currency:** Revenue/earnings use Rials; display uses `formatCompactMoney` (e.g. “۱۵ میلیون ریال”) or toLocaleString('fa-IR') for employee.
6. **Dates:** Customer uses Jalali via `formatJalaliDateTime`; Employee uses date-fns `format(..., 'PPP', { locale: faIR })` and time `HH:mm`.
