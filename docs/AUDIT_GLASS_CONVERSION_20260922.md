# Audit: Glass Conversion Scope — 2026-09-22

**Mode:** READ-ONLY discovery (this file is the sole deliverable write).  
**Baseline tag (local):** `v2.0.9-glasschip` @ `29fa210`  
**Production BUILD_ID (Phase 11 evidence):** `8Gd4etZ-wCok7njiRXtc3` — GlassChip Active  
**SSH this phase:** **Skipped** — CSS inventory is fully local; live glass baseline already verified in Phase 11 closeout (`docs/DEPLOYMENT_HISTORY.md`, registry). No production mutation.

---

## 1. Executive summary

Canonical interactive glass lives in `frontend/src/components/ui/glass-chip.tsx` (`data-chip` + `.glass-chip`). It is already used for booking time slots and dashboard appointment status filters.

The dominant source of solid white interactive controls is **not** forty one-off pages — it is:

1. **`Button` `default` / `primary`** → `dark:bg-white` (shared; ~90 import sites)
2. **Global CSS locks** that force `#ffffff` on inverted CTAs (`contrast-fix.css`, `aurora-dashboard.css` auth/dashboard rules)
3. A smaller set of **inline `bg-white text-black` CTAs** (landing, shop, login submit, FAB, sidebar active, alerts)

**Plan of Record:** introduce a shared glass CTA path (`buttonVariants.glass` and/or `GlassButton` reusing GlassChip tokens) + stop forcing solid white via `!important` for glass-marked buttons — **one overlay-sized change**, then migrate call sites by class/variant, not 40 independent style rewrites.

---

## 2. CANONICAL GLASS STYLE REFERENCE

**Source:** `frontend/src/components/ui/glass-chip.tsx` (lines 23–40)

| Token | Value (quoted from source) |
|------|----------------------------|
| Root attrs | `data-chip=""`, `data-selected`, `aria-pressed` (omitted when disabled) |
| Layout | `glass-chip inline-flex min-h-11 … rounded-xl border px-3 py-2 text-sm font-medium backdrop-blur-md transition-all duration-200` |
| Idle fill | `border-white/15 bg-white/5 text-zinc-100` |
| Hover | `hover:border-white/25 hover:bg-white/10` |
| Focus ring | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950` |
| Selected | `border-white/40 bg-white/15 font-semibold text-white ring-2 ring-amber-200/80` |
| Disabled | `cursor-not-allowed opacity-40 hover:border-white/15 hover:bg-white/5` |

**Public booking light-island remaps** (must stay coordinated): `.aurora-public-booking button.glass-chip…` in `aurora-dashboard.css` (≈259–284) remaps idle/hover/selected to dark-tint glass on white cards (`rgb(17 24 39 / 0.05…0.16)`). Any new glass CTA on public booking must either keep `data-chip` / `.glass-chip` or gain matching scoped rules.

**Already glass (EXCLUDE from convert):**

| Consumer | File |
|---------|------|
| SlotPicker | `components/appointments/SlotPicker.tsx` |
| SlotPickerProfessional | `components/appointments/SlotPickerProfessional.tsx` |
| BookingModal slots | `components/booking/BookingModal.tsx` |
| Public book-appointment slots | `app/book-appointment/page.tsx` |
| Dashboard status filters | `app/dashboard/appointments/page.tsx` |
| Badge `outline` / `glass` | `components/ui/badge.tsx` |
| Button `secondary` (dark) | already `dark:bg-white/10` — near-glass |
| Auth shell panel | `AuthSplitShell` `bg-white/5` |

---

## 3. Conflicting global CSS (ground truth)

These rules **override** Tailwind glass tokens unless selectors exclude glass markers:

| Rule | File:Lines | Effect on glass |
|------|------------|-----------------|
| `button.bg-white…` / `button[class*="dark:bg-white"]:not([class*="bg-white/"])…` → `#ffffff !important` | `app/contrast-fix.css:123–127` | Locks solid white CTAs; GlassChip excluded via `:not([data-chip]):not(.glass-chip)` |
| Same inverted CTA lock under dashboard | `app/aurora-dashboard.css:39–45` | Same; also `a.bg-white.text-black` |
| Auth full-width / submit → white | `app/aurora-dashboard.css:108–112` | Forces login/OTP primary buttons solid white **even if Button is glassified** unless rule updated |
| Non-button `.bg-white` → card remap | `contrast-fix.css:91–97`, `aurora-dashboard.css:31–37` | Panels only; not primary convert target |
| Public booking island white cards | `aurora-dashboard.css:249–255` | Surfaces; chips already exempt |
| Print `body { bg-white }` | `app/globals.css:575–577` | Print only — EXCLUDE |

**Implication:** changing `button.tsx` alone is **insufficient**. Auth/dashboard `!important` white CTA rules must be updated in the same change set or glass will not render.

---

## 4. Shared-UI source of truth

| Layer | Path | Role |
|------|------|------|
| Canonical chip | `components/ui/glass-chip.tsx` | Selectable chips / filters / slots |
| Shared Button | `components/ui/button.tsx` | App-wide CTA; **default + primary = solid white in dark** |
| Alert primary action | `components/ui/alert-dialog.tsx:107` | Hardcoded `bg-white text-zinc-950` (bypasses buttonVariants) |
| Select trigger | `components/ui/select.tsx:23` | `bg-white dark:bg-zinc-900/80` — form control, not chip |
| Tabs | `components/ui/tabs.tsx` | `data-[state=active]:bg-background` — muted, not solid white CTA |
| Badge | `components/ui/badge.tsx` | Already has `glass` / `outline` glass-ish variants |
| Inputs | `input.tsx`, `MoneyInput.tsx`, `PersianDatePicker.tsx` | Light fills = form surfaces |

**Blast radius:** `Button` is imported from `@/components/ui/button` in **~90 files**. A naïve rewrite of `default`/`primary` to glass touches the whole dashboard in one deploy — high leverage, high visual-QA cost.

**Recommendation (component strategy):**

1. **Keep `GlassChip`** for toggleable / selectable chip UX (`selected` + `aria-pressed`).
2. **Add `buttonVariants.glass`** (same tokens as GlassChip idle/hover/focus; optional `data-glass` / `.glass-chip`-compatible class for CSS exemptions) **or** thin `GlassButton` wrapper that applies those classes via `Button`/`asChild`.
3. **Do not** silently remap all `default`/`primary` in wave 1 without a QA matrix; prefer new `variant="glass"` + migrate known white CTAs, **or** remap `default`/`primary` dark tokens only after contrast-fix/aurora locks are relaxed for `.glass-chip` / `[data-glass]`.

---

## 5. Full inventory table

Class names abbreviated. **Action** key: `CONVERT` | `INHERIT-NEEDS-DOC` | `POSTPONE` | `EXCLUDE`.

### 5.1 Shared primitives (highest leverage)

| Component | File:Line | Current style | Class / token | Action |
|-----------|-----------|---------------|---------------|--------|
| Button default | `components/ui/button.tsx:11` | Solid white in dark | `dark:bg-white dark:text-zinc-950` | **INHERIT-NEEDS-DOC** (app-wide) |
| Button primary | `components/ui/button.tsx:12` | Solid white in dark | `dark:bg-white …` | **INHERIT-NEEDS-DOC** |
| Button secondary | `components/ui/button.tsx:13` | Already translucent | `dark:bg-white/10` | **EXCLUDE** (near-glass) |
| Button outline | `components/ui/button.tsx:17` | Light fill light-mode | `bg-white dark:bg-transparent` | **INHERIT-NEEDS-DOC** (light only) |
| AlertDialogAction | `components/ui/alert-dialog.tsx:107` | Solid white CTA | `bg-white text-zinc-950` | **CONVERT** |
| GlassChip | `components/ui/glass-chip.tsx:31–38` | Canonical glass | `bg-white/5` … | **EXCLUDE** |
| Badge outline/glass | `components/ui/badge.tsx:17–18` | Glass-ish | `bg-white/5`, `bg-white/[0.04]` | **EXCLUDE** |
| SelectTrigger | `components/ui/select.tsx:23` | Solid white light / zinc dark | `bg-white dark:bg-zinc-900/80` | **POSTPONE** (form field) |
| SelectContent | `components/ui/select.tsx:79` | Panel | `bg-white dark:bg-zinc-950/95` | **POSTPONE** |
| Input filled | `components/ui/input.tsx:6–12` | Form field | `bg-white` / `bg-gray-50` | **POSTPONE** |
| MoneyInput | `components/ui/MoneyInput.tsx:118` | Form field | `bg-white` | **POSTPONE** |
| PersianDatePicker input | `components/ui/PersianDatePicker.tsx:178,259` | Form field | `bg-white` | **POSTPONE** |
| TabsTrigger | `components/ui/tabs.tsx:31` | Active = background | `data-[state=active]:bg-background` | **INHERIT-NEEDS-DOC** (token, not solid white) |
| Calendar day_selected | `components/ui/calendar.tsx:43–44` | Primary fill | `bg-primary` | **EXCLUDE** (brand, not white) |
| Switch thumb | `components/ui/switch.tsx:22` | `bg-background` | — | **POSTPONE** |
| Card / ResponsiveCard glass variants | `card.tsx`, `responsive-card.tsx` | Surface glass | `bg-white/[0.03]` | **EXCLUDE** / surface |

### 5.2 Inline solid-white interactive CTAs (CONVERT)

| Component | File:Line | Current style | Class | Action |
|-----------|-----------|---------------|-------|--------|
| Landing primary CTA | `app/page.tsx:141` | Solid white button | `bg-white … text-black` | **CONVERT** |
| Landing secondary | `app/page.tsx:148` | Outline ghost | `border-white/20 hover:bg-white/10` | **EXCLUDE** (already glass-ish) |
| Landing service book | `app/page.tsx:196` | Solid white | `bg-white … text-black` | **CONVERT** |
| Landing products CTA | `app/page.tsx:237` | Solid white | `bg-white … text-black` | **CONVERT** |
| LandingHeader book | `landing/LandingHeader.tsx:66` | Solid white | `bg-white … text-black` | **CONVERT** |
| LandingHeader mobile book | `landing/LandingHeader.tsx:118` | Solid white | `bg-white … text-black` | **CONVERT** |
| LandingHeader nav ghosts | `LandingHeader.tsx:54,60,96,104,111` | Outline / hover glass | `hover:bg-white/10` | **EXCLUDE** |
| Products add-to-cart | `app/products/page.tsx:266` | Solid white | `bg-white … text-black` | **CONVERT** |
| Products secondary | `app/products/page.tsx:277` | Outline | `hover:bg-white/10` | **EXCLUDE** |
| CartSummary checkout | `shop/CartSummary.tsx:18` | Solid white | `bg-white … text-black` | **CONVERT** |
| Checkout submit | `shop/CheckoutForm.tsx:208,405` | Solid white on Button | `bg-white text-black` | **CONVERT** |
| Login password submit | `app/login/page.tsx:142` | Solid white | `bg-white … text-black` | **CONVERT** (+ auth CSS lock) |
| Customer home CTA | `dashboard/customer/page.tsx:199` | Solid white on Button | `bg-white text-black` | **CONVERT** |
| NotificationPrompt allow | `NotificationPrompt.tsx:171` | Solid white | `bg-white text-black` | **CONVERT** |
| NotificationPrompt dismiss | `NotificationPrompt.tsx:196,207` | Ghost | `hover:bg-white/10` | **EXCLUDE** |
| DashboardShell FAB | `layout/DashboardShell.tsx:108` | Solid white circle | `bg-white text-gray-900` | **CONVERT** |
| DashboardShell Button | `DashboardShell.tsx:101` | `variant="primary"` | inherits white | **INHERIT-NEEDS-DOC** |
| Sidebar active nav | `RoleBasedSidebar.tsx:427` | Solid white selected | `bg-white text-black` | **CONVERT** (selected state → glass selected tokens) |
| Sidebar collapse btn | `RoleBasedSidebar.tsx:376` | Ghost hover | `hover:bg-white/10` | **EXCLUDE** |
| Admin home primary | `dashboard/admin/page.tsx:138` | `variant="primary"` | inherits | **INHERIT-NEEDS-DOC** |
| PhoneOtpAuth buttons | `auth/PhoneOtpAuth.tsx:182,224,256` | Default Button | inherits + auth CSS force white | **INHERIT-NEEDS-DOC** |

### 5.3 Chip / filter / badge competitors (not yet GlassChip)

| Component | File:Line | Current style | Class | Action |
|-----------|-----------|---------------|-------|--------|
| Appointment status Badge | `appointments/AppointmentList.tsx:151–158` | Light solid pills | `bg-green-100`, `bg-gray-100` | **CONVERT** (→ Badge `glass` or GlassChip read-only styling; non-toggle) |
| Stats count pills | `dashboard/appointments/page.tsx:201`; `admin/appointments/page.tsx:405`; `employee/appointments/page.tsx:277` | Translucent pill | `bg-white/20 rounded-full` | **INHERIT-NEEDS-DOC** (decorative count, not white solid) |
| Day-closing badges | `admin/day-closing/page.tsx:284,290` | Light fills | `bg-green-100`, `bg-yellow-100` | **CONVERT** or status-token glass |
| ServicesMultiSelect row | `ServicesMultiSelect.tsx:108` | Hover light | `hover:bg-gray-50` | **INHERIT-NEEDS-DOC** |
| BookingModal radio labels | `BookingModal.tsx:687,712` | Hover light | `hover:bg-gray-50` | **INHERIT-NEEDS-DOC** (selectable cards — candidate GlassChip/card glass later) |
| Salary status colors | `accounting/salaries/[barberId]/page.tsx:118` | Light pills | `bg-gray-100` | **CONVERT** (status chip family) |
| Chequebook status | `accounting/chequebooks.tsx:129` | Light pills | `bg-gray-100` | **CONVERT** (status chip family) |

### 5.4 GlassChip already applied (EXCLUDE)

| Component | File:Line | Action |
|-----------|-----------|--------|
| GlassChip root | `glass-chip.tsx` | **EXCLUDE** |
| SlotPicker | `SlotPicker.tsx:196` | **EXCLUDE** |
| SlotPickerProfessional | `SlotPickerProfessional.tsx:189,216` | **EXCLUDE** |
| BookingModal slots | `BookingModal.tsx:809,835` | **EXCLUDE** |
| book-appointment slots | `book-appointment/page.tsx:375` | **EXCLUDE** |
| Dashboard status filters | `dashboard/appointments/page.tsx:357` | **EXCLUDE** |

### 5.5 Surfaces / panels (POSTPONE — not interactive buttons)

| Component | File:Line | Notes | Action |
|-----------|-----------|-------|--------|
| BookingModal dialog | `BookingModal.tsx:489` | `bg-white/95` panel | **POSTPONE** |
| BookingModal footer | `BookingModal.tsx:904` | `bg-gray-50/80` | **POSTPONE** |
| AuthSplitShell / aurora shell | `AuthSplitShell.tsx` | Already glass panel | **EXCLUDE** |
| Employee-salary Cards | `admin/employee-salary/page.tsx:351,493,572,887` | `bg-white` cards | **POSTPONE** |
| Chart tooltips | `overview.tsx`, `overview-chart.tsx`, `monthly-chart.tsx` | `bg-white` tooltip | **POSTPONE** |
| Date-range popover | `date-range-filter.tsx:139` | Panel | **POSTPONE** |
| ErrorBoundary code blocks | `common/ErrorBoundary.tsx:177,186` | Mono panels | **POSTPONE** |
| Accounting gray panels | `barber-overview`, `barber-balances`, etc. | `bg-gray-50` | **POSTPONE** |
| Test pages | `test-simple`, `test-date` | Dev only | **POSTPONE** / ignore |
| Design tokens `--bg-secondary: #ffffff` | `styles/design-tokens.css` | Theme tokens | **POSTPONE** |
| `force-theme.ts` gray remaps | `lib/force-theme.ts` | Runtime CSS injection | **INHERIT-NEEDS-DOC** (verify if still mounted) |

---

## 6. Single list — shared files that kill whites in one sweep

Touch these (in one coordinated PR / overlay), not forty pages:

1. **`frontend/src/components/ui/button.tsx`** — add `glass` variant (tokens from GlassChip); optionally retarget `default`/`primary` dark fills after QA.
2. **`frontend/src/components/ui/glass-chip.tsx`** — keep as chip SoT; export shared token string/constant if Button reuses.
3. **`frontend/src/app/contrast-fix.css`** — extend exemptions (`[data-glass]`, `.glass-button`) **or** stop forcing `#ffffff` on glass CTAs.
4. **`frontend/src/app/aurora-dashboard.css`** — same for dashboard inverted CTA rules **and** `.aurora-auth-shell form button[type="submit"]` / `button.w-full` white force (lines 108–112).
5. **`frontend/src/components/ui/alert-dialog.tsx`** — replace hardcoded `bg-white` Action with `glass` / shared Button.
6. *(Wave-2 optional)* **`RoleBasedSidebar.tsx`**, **`DashboardShell.tsx` FAB**, landing/shop/login inline CTAs — switch to `variant="glass"` once shared path exists.

**Not in the kill list for this pass:** `select.tsx`, `input.tsx`, Card panels, chart tooltips.

---

## 7. Plan of Record (recommended)

### Goal
One deployable overlay: **shared glass CTA + chip SoT + remove conflicting solid-white `!important` for glass-marked controls** — not 40 scattered class edits.

### Wave A (implementation candidate — not executed this phase)

1. Extract shared class bundle from GlassChip (idle/hover/focus; selected stays chip-only).
2. Add `buttonVariants.glass` (+ `data-glass=""` for CSS hooks).
3. Update `contrast-fix.css` + `aurora-dashboard.css` so glass / `data-glass` / `.glass-chip` are never forced to `#ffffff`.
4. Soften or dual-path auth rule: allow glass submit OR keep intentional solid white only behind an explicit `.aurora-auth-solid-cta` class (invert today’s default).
5. Convert AlertDialogAction + known inline CONVERT CTAs (landing, header, shop, login, FAB, NotificationPrompt allow) to `glass`.
6. Sidebar active: map to GlassChip **selected** tokens (border/bg/ring), not solid white.
7. Status badges (`AppointmentList`, chequebooks, salaries): Prefer `Badge variant="glass"` or a non-button `GlassPill` — do not misuse `aria-pressed` chips for static status.

### Wave B (explicit QA gate)

- Remap Button `default`/`primary` dark from solid white → glass **only after** Wave A + visual QA matrix (admin / employee / customer / auth / public booking / shop).
- Public booking: confirm `.aurora-public-booking` chip remaps still pass hover/selected (Phase 8.1 contract).

### Out of scope this conversion

- Form fields (Input, Select, MoneyInput, DatePicker)
- Card / dialog / tooltip surfaces
- Destructive / success / warning solid brand buttons (keep semantic color)
- Print CSS

### Validation (when implementing later)

- Unit: extend glass-chip / button glass contract tests (no solid `\bbg-white\b` on glass roots).
- Visual: light public booking + dark dashboard + auth submit.
- Overlay deploy only (Ubuntu build); no git-pull on prod.

### Rollback

- Revert overlay to pre-change FE standalone backup; CSS locks restore previous inverted white CTAs.

---

## 8. Production / local alignment

| Check | Result |
|-------|--------|
| Local tag | `v2.0.9-glasschip` present after Phase 11 |
| Prod BUILD_ID | Phase 11: `8Gd4etZ-wCok7njiRXtc3` (GlassChip Active) |
| SSH this audit | **Not used** (unnecessary for static CSS inventory) |
| Code vs live | Local GlassChip source matches what Phase 10 packaged; no claim of server source tree sync (overlay model) |

---

## 9. Unknowns / need verification (before implement)

1. Whether product intent is **glass for all dark CTAs** vs **keep solid white for primary brand CTAs** (landing/auth) and glass only for chips/filters.
2. Whether `force-theme.ts` still injects at runtime on dashboard (could fight glass).
3. Exact count of `<Button>` with no `variant` (defaults to white-in-dark) — treat as full INHERIT list until Wave B QA.
4. Customer/employee appointment pages may still use Select filters (not GlassChip) — confirm if status-filter glass should expand beyond admin `/dashboard/appointments`.

---

## 10. Recommended next prompts

1. **Phase 2 implement Wave A only** — `buttonVariants.glass` + CSS exemption + convert listed CONVERT CTAs + AlertDialog; do **not** remap default/primary globally yet.  
2. **Visual QA matrix** for Wave A on local, then packaging.  
3. **Decision gate:** solid white primary brand vs full glass CTAs before Wave B.

---

## Phase 2 implementation note (2026-09-22)

Local Wave A applied. Manifest: [`docs/GLASS_IMPLEMENTATION_20260922.md`](GLASS_IMPLEMENTATION_20260922.md).  
No build/test/deploy in Phase 2. Brand/auth solid CTAs marked `[GATED-W-B]` in source.

---

*End of audit. No application code, builds, deploys, or production changes performed in this phase beyond writing this report.*
