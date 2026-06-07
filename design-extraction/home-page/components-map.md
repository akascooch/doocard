# Components Map – Home Page Redesign

**LOCAL ONLY. NO DEPLOY.**

---

## Components Directly Used by Home Pages

### Dashboard Redirect (`dashboard/page.tsx`)

| Import | Source Path |
|--------|-------------|
| `useEffect` | react |
| `useRouter` | next/navigation |
| `getCurrentUser` | @/lib/auth |

No UI components; only spinner and text in JSX.

---

### Admin Home (`dashboard/admin/page.tsx`)

| Import | Source Path |
|--------|-------------|
| Card, CardContent, CardDescription, CardHeader, CardTitle | `@/components/ui/card` → `frontend/src/components/ui/card.tsx` |
| Button | `@/components/ui/button` → `frontend/src/components/ui/button.tsx` |
| Badge | `@/components/ui/badge` → `frontend/src/components/ui/badge.tsx` |
| Icons | lucide-react (Calendar, Users, DollarSign, TrendingUp, UserCog, Clock, CheckCircle, BarChart3, ArrowUpRight, Sparkles, Settings, Shield, etc.) |
| getCurrentUser | `@/lib/auth` → `frontend/src/lib/auth.ts` |
| formatCompactMoney | `@/lib/money` → `frontend/src/lib/money.ts` |

---

### Customer Home (`dashboard/customer/page.tsx`)

| Import | Source Path |
|--------|-------------|
| Card, CardContent, CardDescription, CardHeader, CardTitle | `frontend/src/components/ui/card.tsx` |
| Button | `frontend/src/components/ui/button.tsx` |
| Badge | `frontend/src/components/ui/badge.tsx` |
| BookingModal | `@/components/booking/BookingModal` → `frontend/src/components/booking/BookingModal.tsx` |
| Icons | lucide-react |
| getCurrentUser | `@/lib/auth` |
| formatJalaliDateTime | `@/lib/date` → `frontend/src/lib/date.ts` |

---

### Employee Home (`dashboard/employee/page.tsx`)

| Import | Source Path |
|--------|-------------|
| Card, CardContent, CardDescription, CardHeader, CardTitle | `frontend/src/components/ui/card.tsx` |
| Button | `frontend/src/components/ui/button.tsx` |
| Badge | `frontend/src/components/ui/badge.tsx` |
| format (date-fns), faIR | date-fns |
| getCurrentUser | `@/lib/auth` |
| axios | `@/lib/axios` |

---

### Dashboard Layout (`dashboard/layout.tsx`)

| Import | Source Path |
|--------|-------------|
| RoleBasedSidebar | `@/components/RoleBasedSidebar` → `frontend/src/components/RoleBasedSidebar.tsx` |
| Button | `frontend/src/components/ui/button.tsx` |
| Menu, X | lucide-react |
| motion, AnimatePresence | framer-motion |
| getCurrentUser, subscribeAuthDegraded, isAuthDegraded | `@/lib/auth`, `@/lib/axios` |
| Footer | `@/components/Footer` → `frontend/src/components/Footer.tsx` |
| NotificationProvider | `frontend/src/components/NotificationProvider.tsx` |
| ErrorBoundary | `frontend/src/components/common/ErrorBoundary.tsx` |
| GlobalErrorHandler | `frontend/src/components/common/GlobalErrorHandler.tsx` |
| NotificationPrompt | `frontend/src/components/NotificationPrompt.tsx` |

---

## Shared UI Components (Source Paths and Usage)

| Component | Path | Used On Home |
|-----------|------|--------------|
| Card (+ Header, Title, Description, Content, Footer) | `frontend/src/components/ui/card.tsx` | Admin, Customer, Employee |
| Button | `frontend/src/components/ui/button.tsx` | Admin, Customer, Employee, Layout |
| Badge | `frontend/src/components/ui/badge.tsx` | Admin, Customer, Employee |

**Note:** Admin and layout use `variant="primary"` on Button. The current `button.tsx` CVA does not define a `primary` variant (only default, secondary, destructive, success, warning, outline, ghost, link). Either a separate wrapper adds it or it falls back to default—document for Figma so primary is defined in design system.

---

## Shared UI Component Details

### Card (`components/ui/card.tsx`)

- **Variants:** default, elevated, glass, outline, gradient, success, warning, surface.
- **Padding:** none, sm, default, lg, xl.
- **Interactive:** boolean for hover scale/shadow.
- **Subcomponents:** CardHeader (flex flex-col space-y-3 p-6 md:p-8), CardTitle (text-xl md:text-2xl font-semibold), CardDescription (text-sm md:text-base text-muted-foreground), CardContent (p-6 md:p-8 pt-0), CardFooter (flex justify-between gap-4, same padding).

### Button (`components/ui/button.tsx`)

- **Variants:** default (gray-600), secondary (brand-green-600), destructive, success, warning, outline, ghost, link.
- **Sizes:** default (h-12), sm (h-9), lg (h-14), xl (h-16), icon, icon-sm, icon-lg.
- **Note:** `primary` is used in code but not in CVA; treat as design-system primary (e.g. brand primary) in Figma.

### Badge (`components/ui/badge.tsx`)

- **Variants:** default (gray-600), secondary (brand-green-600), destructive, success, warning, info, outline, glass.
- **Style:** rounded-full, px-3 py-1.5, text-xs font-bold, uppercase, tracking-wide.

---

## Other Components Referenced (Not on Home but in Flow)

- **BookingModal** (customer home only): `frontend/src/components/booking/BookingModal.tsx` – multi-step booking (services, employee, date, time, confirm). Uses Dialog, Button, Card, Badge, PersianDatePicker, toast, axios, date lib.
- **RoleBasedSidebar:** `frontend/src/components/RoleBasedSidebar.tsx` – role-based nav (admin / employee / customer menu items), AppLogo, LogoutButton.
- **Footer:** `frontend/src/components/Footer.tsx` – simple footer with Instagram link.
- **AppLogo:** `frontend/src/components/common/AppLogo.tsx` – used in sidebar (and landing).

---

## Full File Paths for Redesign Bundle

```
frontend/src/app/dashboard/page.tsx
frontend/src/app/dashboard/layout.tsx
frontend/src/app/dashboard/admin/page.tsx
frontend/src/app/dashboard/customer/page.tsx
frontend/src/app/dashboard/employee/page.tsx
frontend/src/components/ui/card.tsx
frontend/src/components/ui/button.tsx
frontend/src/components/ui/badge.tsx
frontend/src/components/RoleBasedSidebar.tsx
frontend/src/components/Footer.tsx
frontend/src/components/booking/BookingModal.tsx
frontend/src/components/common/AppLogo.tsx
frontend/src/components/common/ErrorBoundary.tsx
frontend/src/components/NotificationProvider.tsx
frontend/src/components/NotificationPrompt.tsx
frontend/src/components/GlobalErrorHandler.tsx (or common/GlobalErrorHandler)
frontend/src/lib/auth.ts
frontend/src/lib/money.ts
frontend/src/lib/date.ts
frontend/src/lib/axios.ts (if needed for API pattern)
```

(GlobalErrorHandler path to be confirmed in project; may be `common/GlobalErrorHandler`.)
