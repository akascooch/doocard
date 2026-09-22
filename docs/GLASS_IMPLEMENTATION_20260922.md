# Glass Implementation — Phase 2 Local (2026-09-22)

**Mode:** LOCAL EDIT only. No build, no test run, no commit/push, no SSH/deploy.  
**Ground truth:** `docs/AUDIT_GLASS_CONVERSION_20260922.md`  
**Status:** **READY FOR QA / PHASE 3** (shared glass path + CONVERT pilot complete; Wave B gated).

---

## 1. Token diff (before → after)

### Before (GlassChip-only, duplicated inline)

```
border-white/15 bg-white/5 text-zinc-100
hover:border-white/25 hover:bg-white/10
selected → border-white/40 bg-white/15 + ring-amber-200/80
focus → ring-indigo-500/50 + ring-offset-zinc-950
```

No shared module; Button `default`/`primary` still `dark:bg-white` (unchanged this phase).

### After — canonical module `frontend/src/lib/glass-tokens.ts`

| Token export | Value |
|-------------|--------|
| `GLASS_SURFACE` | `border-white/15 bg-white/5 text-zinc-100 backdrop-blur-md` |
| `GLASS_HOVER` | `hover:border-white/25 hover:bg-white/10` |
| `GLASS_FOCUS` | indigo focus-visible ring (same as chip) |
| `GLASS_SELECTED` | `border-white/40 bg-white/15 … ring-2 ring-amber-200/80` |
| `GLASS_DISABLED_CHIP` | opacity-40 + idle hover lock |
| `GLASS_CHIP_LAYOUT` | `glass-chip` layout shell |
| `GLASS_BUTTON_SURFACE` | `glass-button` + surface + hover |
| `GLASS_NAV_ACTIVE` | selected-style for nav links |

### CSS vars — `frontend/src/app/glass-exemptions.css` (new; imported **after** `contrast-fix.css` + `aurora-dashboard.css`)

```css
--glass-bg: rgb(255 255 255 / 0.05);
--glass-bg-hover: rgb(255 255 255 / 0.1);
--glass-bg-selected: rgb(255 255 255 / 0.15);
--glass-border / hover / selected;
--glass-fg / --glass-fg-selected;
```

Higher-specificity `!important` exemptions for `button.glass-chip[data-chip]`, `button.glass-button[data-glass]`, `a[data-glass]`, plus auth-shell / dashboard-canvas scoped glass so solid-white locks cannot win on glass-marked controls. **Global contrast-fix hard overrides were not rewritten wholesale.**

---

## 2. Components created / changed

| File | Change |
|------|--------|
| `frontend/src/lib/glass-tokens.ts` | **Created** — shared tokens |
| `frontend/src/app/glass-exemptions.css` | **Created** — CSS vars + exemptions |
| `frontend/src/app/layout.tsx` | Import `glass-exemptions.css` after aurora |
| `frontend/src/components/ui/glass-chip.tsx` | Consumes tokens; adds `data-glass` (keeps `data-chip` / `aria-pressed`) |
| `frontend/src/components/ui/button.tsx` | Adds `variant: "glass"`; sets `data-glass` when glass. **default/primary untouched** |
| `frontend/src/components/ui/glass-button.tsx` | **Created** — thin `GlassButton` → `variant="glass"` |
| `frontend/src/components/ui/alert-dialog.tsx` | AlertDialogAction → glass classes + `data-glass` |
| `frontend/src/components/layout/DashboardShell.tsx` | FAB → `variant="glass"` |
| `frontend/src/components/RoleBasedSidebar.tsx` | Active nav → glass selected tokens + `data-glass` / `data-selected` |
| `frontend/src/components/NotificationPrompt.tsx` | Allow CTA → `variant="glass"` |
| `frontend/src/app/dashboard/customer/page.tsx` | Book CTA → `variant="glass"` |
| `frontend/src/components/shop/CartSummary.tsx` | Cart button → glass + `data-glass` |
| `frontend/src/components/shop/CheckoutForm.tsx` | Close + submit → `variant="glass"` |
| `frontend/src/app/products/page.tsx` | Add-to-cart → glass + `data-glass` |
| `frontend/src/components/appointments/AppointmentList.tsx` | Status badges → `Badge variant="glass"` + tint borders |
| `frontend/src/app/dashboard/admin/day-closing/page.tsx` | Count badges → glass |
| `frontend/src/app/dashboard/accounting/salaries/[barberId]/page.tsx` | Type pills → glass tints |
| `frontend/src/components/accounting/chequebooks.tsx` | Status badges → glass |
| `frontend/src/app/page.tsx` | **GATED-W-B comments only** (styling unchanged) |
| `frontend/src/components/landing/LandingHeader.tsx` | **GATED-W-B comments only** |
| `frontend/src/app/login/page.tsx` | **GATED-W-B comment only** |
| `frontend/src/components/auth/PhoneOtpAuth.tsx` | **GATED-W-B comments only** |

---

## 3. Converted components (source / intent)

| Component | File | Treatment |
|-----------|------|-----------|
| AlertDialogAction | `alert-dialog.tsx` ~107 | Glass CTA |
| Dashboard FAB | `DashboardShell.tsx` ~100 | `variant="glass"` |
| Sidebar active link | `RoleBasedSidebar.tsx` ~420 | Selected glass |
| Notification allow | `NotificationPrompt.tsx` ~168 | `variant="glass"` |
| Customer book CTA | `customer/page.tsx` ~196 | `variant="glass"` |
| CartSummary | `CartSummary.tsx` ~14 | Glass button |
| Checkout close/submit | `CheckoutForm.tsx` ~206, ~401 | `variant="glass"` |
| Product add-to-cart | `products/page.tsx` ~266 | Glass button |
| Appointment status Badge | `AppointmentList.tsx` ~145 | `variant="glass"` |
| Day-closing badges | `day-closing/page.tsx` ~284 | `variant="glass"` |
| Salary type Badge | `salaries/[barberId]/page.tsx` ~112, ~267 | `variant="glass"` |
| Cheque status Badge | `chequebooks.tsx` ~124, ~704 | `variant="glass"` |
| GlassChip (slots/filters) | already glass; now tokenized | EXCLUDE / shared SoT |

Time-slot / dashboard status **filter chips** were already GlassChip (Phase 8–10) — not re-styled beyond token centralization.

---

## 4. [GATED-W-B] deferred (intentionally untouched styling)

| Item | File | Reason |
|------|------|--------|
| Landing hero book CTA | `app/page.tsx` ~141 | Brand primary CTA |
| Landing service «رزرو» | `app/page.tsx` ~194 | Brand primary CTA |
| Landing barber book | `app/page.tsx` ~235 | Brand primary CTA |
| Header book (desktop) | `LandingHeader.tsx` ~64 | Brand primary CTA |
| Header book (mobile) | `LandingHeader.tsx` ~116 | Brand primary CTA |
| Login password submit | `login/page.tsx` ~140 | Auth submit + aurora white force |
| PhoneOtpAuth CTAs | `PhoneOtpAuth.tsx` (3 buttons) | Auth inherits Button default |
| Button `default` / `primary` global | `button.tsx` | Explicit no blanket remap until QA gate |

---

## 5. Explicitly not touched (POSTPONE / EXCLUDE)

- Form fields (Input, Select, MoneyInput, PersianDatePicker)
- Cards / dialog shells / chart tooltips
- `Button` default/primary dark solid white
- Landing outline / ghost links already glass-ish
- Existing GlassChip consumers (SlotPicker*, BookingModal slots, book-appointment, dashboard filters) — token consume only

---

## 6. Guardrails respected

- No `npm run build` / tests / commit / push / SSH
- No global remap of `default`/`primary`
- A11y: GlassChip still uses `data-chip` + `aria-pressed`; Button glass uses `data-glass`; disabled keeps `pointer-events-none` / opacity
- contrast-fix / aurora solid-white rules left in place; exemptions layered on top

---

## 7. READY FOR QA / PHASE 3

**Yes — READY FOR QA/PHASE 3.**

Shared path complete (`glass-tokens` + `variant="glass"` / `GlassButton` + exemption CSS). CONVERT pilot applied. GATED-W-B items documented in source + this file.

**Suggested Phase 3 checks (do not run until go-ahead):**

1. Unit: glass-chip + new glass button contract (no solid `\bbg-white\b` on glass roots)
2. Visual: dashboard FAB + sidebar active, shop cart/checkout, customer book CTA, appointment status badges, alert dialogs
3. Confirm landing/login still solid white (gated)
4. Public booking GlassChip hover/selected still pass (Phase 8.1 contract)

**Blockers:** none for Phase 3 QA start. Wave B product decision remains open for brand/auth CTAs.
