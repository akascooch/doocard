# home-page-source.zip – File List

**LOCAL ONLY. NO DEPLOY.**

This document lists every file included in `home-page-source.zip` (necessary files for Home/Dashboard redesign only, not the entire project).

---

## Full List of Files in Zip

```
frontend/
├── tailwind.config.ts
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── dashboard/
    │   │   ├── page.tsx
    │   │   ├── layout.tsx
    │   │   ├── admin/
    │   │   │   └── page.tsx
    │   │   ├── customer/
    │   │   │   └── page.tsx
    │   │   └── employee/
    │   │       └── page.tsx
    │   └── api/
    │       └── dashboard/
    │           ├── admin-stats/
    │           │   └── route.ts
    │           ├── customer-stats/
    │           │   └── route.ts
    │           ├── customer-upcoming-appointments/
    │           │   └── route.ts
    │           ├── employee-stats/
    │           │   └── route.ts
    │           └── employee-today-appointments/
    │               └── route.ts
    ├── components/
    │   ├── RoleBasedSidebar.tsx
    │   ├── Footer.tsx
    │   ├── ui/
    │   │   ├── card.tsx
    │   │   ├── button.tsx
    │   │   └── badge.tsx
    │   ├── booking/
    │   │   └── BookingModal.tsx
    │   └── common/
    │       ├── AppLogo.tsx
    │       ├── ErrorBoundary.tsx
    │       └── GlobalErrorHandler.tsx
    └── lib/
        ├── auth.ts
        ├── money.ts
        └── date.ts
```

---

## Count

- **Total files:** 24
- **Page/layout:** 5 (dashboard redirect, layout, admin, customer, employee)
- **API routes:** 5
- **UI components:** 3 (card, button, badge)
- **Other components:** 6 (RoleBasedSidebar, Footer, BookingModal, AppLogo, ErrorBoundary, GlobalErrorHandler)
- **Styles:** 1 (globals.css)
- **Config:** 1 (tailwind.config.ts)
- **Lib:** 3 (auth, money, date)

---

## Not Included (by design)

- Rest of app (e.g. app/page.tsx landing, login, register, other dashboard sub-routes)
- node_modules, .next
- Other UI components (dialog, input, select, table, etc.) unless needed by BookingModal
- Backend or server code
- Environment or deploy configs
