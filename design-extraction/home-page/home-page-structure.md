# Home Page Structure – Design Extraction

**LOCAL ONLY. NO DEPLOY. NO SERVER ACCESS. NO CODE CHANGES.**

---

## STEP 1 – HOME PAGE FILE IDENTIFICATION

### Main Home Page Shown After Login

After login, users are **redirected by role** from the dashboard root. There is **no single “Home” file**; there are **three role-specific home pages**:

| Route | File | Role | Description |
|-------|------|------|-------------|
| `/dashboard` | `frontend/src/app/dashboard/page.tsx` | All | **Redirect only** – shows loading spinner, then redirects to role-specific dashboard |
| `/dashboard/admin` | `frontend/src/app/dashboard/admin/page.tsx` | ADMIN | **Admin Dashboard** – main home for admins |
| `/dashboard/employee` | `frontend/src/app/dashboard/employee/page.tsx` | EMPLOYEE | **Employee Dashboard** – main home for employees |
| `/dashboard/customer` | `frontend/src/app/dashboard/customer/page.tsx` | CUSTOMER | **Customer Dashboard** – main home for customers |

### Confirmation: Which Is the “Main” Home?

- **Dashboard root** (`/dashboard/page.tsx`): Not a content home; it only reads `getCurrentUser()`, then redirects to `/dashboard/admin`, `/dashboard/employee`, or `/dashboard/customer` based on `currentUser.role`.
- **Primary content “Home” pages** are:
  - **Admin:** `frontend/src/app/dashboard/admin/page.tsx` (AdminDashboard)
  - **Employee:** `frontend/src/app/dashboard/employee/page.tsx` (EmployeeDashboard)
  - **Customer:** `frontend/src/app/dashboard/customer/page.tsx` (CustomerDashboard)

### Layout Wrapper (Shared by All Dashboard Pages)

- **Dashboard layout:** `frontend/src/app/dashboard/layout.tsx`
  - Wraps all dashboard routes (including the three home pages).
  - Contains: sidebar (`RoleBasedSidebar`), main content area, mobile overlay, auth-degraded banner, notification provider, footer, mobile sidebar toggle.

---

## Page Structure Summary

### 1. Dashboard Redirect (`/dashboard/page.tsx`)

- **Purpose:** Role-based redirect after login.
- **Content:** Full-screen centered loading spinner + “در حال انتقال به داشبورد…”
- **Logic:** `useEffect` → `getCurrentUser()` → `router.push(/dashboard/admin | /dashboard/employee | /dashboard/customer)`.

### 2. Admin Home (`/dashboard/admin/page.tsx`)

- **Sections:**
  - Welcome header (user name, subtitle, CTA “مدیریت نوبت‌ها”).
  - Main stats grid (4 cards): کل نوبت‌ها، درآمد امسال، کل مشتریان، کارکنان.
  - Secondary stats (3 cards): در انتظار تأیید، تکمیل شده، نرخ تکمیل.
  - Quick actions card (8 buttons: نوبت‌ها، مشتریان، کارکنان، خدمات، حسابداری، کاربران، دسترسی‌ها، تنظیمات).

### 3. Customer Home (`/dashboard/customer/page.tsx`)

- **Sections:**
  - Header (title “داشبورد مشتری”, welcome text, “مشتری” badge).
  - Hero CTA card (gradient: teal → light-blue → main-orange) with “رزرو نوبت جدید” and `BookingModal`.
  - Stats grid (4 cards): کل نوبت‌ها، نوبت‌های آینده، تکمیل شده، لغو شده.
  - “آرایشگر من” card (preferred employee).
  - “نوبت بعدی شما” card (conditional on `nextAppointment`).
  - Quick actions (4 buttons: رزرو نوبت، نوبت‌های من، تاریخچه، تنظیمات).

### 4. Employee Home (`/dashboard/employee/page.tsx`)

- **Sections:**
  - Header (welcome + “مدیریت نوبت‌ها” button).
  - Stats grid (4 cards): نوبت‌های امروز، درآمد ماهانه، کل مشتریان، میانگین امتیاز.
  - “نوبت‌های امروز” card (list of today’s appointments or empty state).
  - Quick actions (4 buttons: نوبت‌های من، درآمدها، مشتریان، تنظیمات).

---

## File Tree (Relevant to Home / Dashboard)

```
frontend/src/app/
├── page.tsx                    # Public landing (not post-login home)
├── layout.tsx                  # Root layout (theme, Toaster, etc.)
├── globals.css                 # Global design tokens
├── dashboard/
│   ├── page.tsx                # Redirect to role-based home
│   ├── layout.tsx              # Dashboard shell (sidebar, main, footer)
│   ├── admin/
│   │   └── page.tsx            # Admin home
│   ├── customer/
│   │   └── page.tsx            # Customer home
│   └── employee/
│       └── page.tsx            # Employee home
```

---

## Constraints for Figma Redesign

1. **RTL:** All dashboard content is RTL (Persian); layout and navigation are right-to-left.
2. **Three variants:** Design for Admin, Customer, and Employee home separately (or one system with role variants).
3. **Shared shell:** Sidebar width (expanded 80/320px, collapsed 20/80px), main content margin, mobile overlay and toggle are defined in `dashboard/layout.tsx`.
4. **No public home in this extraction:** `app/page.tsx` is the marketing/landing page; this document focuses on **post-login dashboard home pages** only.
