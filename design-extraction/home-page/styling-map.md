# Styling Map – Home Page Redesign

**LOCAL ONLY. NO DEPLOY.**

---

## 1. Tailwind Config

**File:** `frontend/tailwind.config.ts` (root) and/or `frontend/src/tailwind.config.ts`

- **Content:** `./src/**/*.{js,ts,jsx,tsx}`
- **darkMode:** `"class"`
- **Theme extend:**  
  - `fontFamily.sans`: `['"IRANSans"', "ui-sans-serif", "system-ui"]`  
  (Note: globals.css and layout use Inter and Vazirmatn; confirm which font is actually applied.)
- No custom breakpoints or container widths in the provided config.

---

## 2. Global CSS – Design Tokens

**File:** `frontend/src/app/globals.css`

### Color Palette (CSS Variables – HSL)

**Light theme (`:root`):**

- **Brand:**  
  - `--brand-grey`, `--brand-grey-light`, `--brand-grey-dark`  
  - `--brand-green`, `--brand-green-light`, `--brand-green-dark`  
  - `--brand-dark`, `--brand-light`
- **Semantic:**  
  - `--background`: 0 0% 98%  
  - `--foreground`: 30 4% 10%  
  - `--card`: 0 0% 100%, `--card-foreground`: 30 4% 10%  
  - `--primary`: 0 0% 42%, `--primary-foreground`: 0 0% 100%  
  - `--secondary`: 162 28% 38%, `--secondary-foreground`: 0 0% 100%  
  - `--muted`, `--muted-foreground`  
  - `--accent`, `--accent-foreground`  
  - `--destructive`, `--destructive-foreground`  
  - `--success`, `--success-foreground`  
  - `--warning`, `--warning-foreground`  
  - `--info`, `--info-foreground`  
  - `--border`, `--input`, `--ring`
- **Radius:** `--radius: 0.75rem` (12px)
- **Shadows:** `--shadow-sm` … `--shadow-xl`, `--shadow-glow-grey`, `--shadow-glow-green`
- **Motion:** `--motion-duration-xs` … `--motion-duration-xl`, `--motion-easing-smooth`, `--motion-easing-bounce`
- **Safe area:** `--safe-area-inset-*`

**Dark theme (`[data-theme="dark"], .dark`):**

- Same token names; values adjusted (e.g. darker background, lighter foreground, brighter primary/secondary for contrast).

### Font Families

- **globals.css:** `font-family: 'Inter', 'Vazirmatn', sans-serif;` on `body`
- **Google Fonts import:** Inter (300–900)
- **Layout:** Inter 300–700
- **Tailwind:** sans = IRANSans (may override in some places)

Use a single source of truth for Figma (e.g. Inter for UI, Vazirmatn for RTL/Persian if used).

### Breakpoints (Tailwind Defaults)

- `sm`: 640px  
- `md`: 768px  
- `lg`: 1024px  
- `xl`: 1280px  
- `2xl`: 1536px  

Dashboard layout uses `lg` (1024px) for sidebar vs mobile.

### Container Widths

- **Layout / sections:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` (common)
- **Dashboard layout main:** `p-6 lg:p-8`; content area has `lg:mr-80` or `lg:mr-20` depending on sidebar state.

### Custom Utility Classes (globals.css)

- **Buttons:** `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-ghost`, `.btn-destructive`, `.btn-success`
- **Cards:** `.card`, `.card-hover`, `.card-flat`, `.card-elevated`
- **Inputs:** `.input`, `.input-error`
- **Badges:** `.badge`, `.badge-default`, `.badge-success`, `.badge-warning`, `.badge-destructive`, `.badge-outline`
- **Nav:** `.nav-item`, `.nav-item-active`
- **Table:** `.table` and thead/th/td/tbody tr styles
- **Layout:** `.container-doocard`, `.section-doocard`, `.divider`, `.glass`, `.gradient-grey`, `.gradient-green`, `.text-gradient`
- **Scrollbar:** `.custom-scrollbar` (webkit)
- **Safe area:** `.safe-area-top`, `.safe-area-bottom`, `.safe-area-inline`, `.safe-area`
- **Animation:** `.animate-in`, `.animate-out`, `.fade-in`, `.fade-out`, `.scale-in`, `.slide-in-*`

### Dark Mode

- **Mechanism:** Class-based (`dark` / `data-theme="dark"`). Root layout injects a script that forces dark theme (sets `data-theme="dark"`, `.dark`, and meta theme-color). So in practice the app often runs in dark mode regardless of user preference.
- **Tokens:** All semantic colors have dark-theme overrides in globals.css.

---

## 3. Custom Colors Used on Home (Not in Tokens)

These appear in **Tailwind class names** on dashboard/customer and related components; they may be Tailwind defaults or custom extend (not present in the minimal tailwind.config we saw):

- **main-orange:** Used for borders, text, backgrounds, spinners, buttons (e.g. `border-main-orange`, `text-main-orange`, `bg-main-orange`, `hover:bg-main-orange/90`). **Define in Figma as a consistent “accent/CTA” color.**
- **teal:** e.g. `from-teal`, `text-teal`, `border-teal` (Tailwind has default `teal`; project may extend).
- **light-blue:** e.g. `from-light-blue`, `text-light-blue`, `border-light-blue`.

Customer hero card: `bg-gradient-to-br from-teal via-light-blue to-main-orange`. Use these three for that gradient in Figma.

---

## 4. Layout (Dashboard)

**File:** `frontend/src/app/dashboard/layout.tsx`

- **Sidebar:** Fixed right (RTL), `w-80` (or collapsed `w-20`); mobile `w-80` overlay. z-50 sidebar, z-40 overlay.
- **Main:** `lg:mr-80` or `lg:mr-20` (when collapsed), `p-6 lg:p-8`, `min-h-screen flex flex-col`.
- **Page transition:** Framer Motion; `key={pathname}`, opacity and y animation.
- **Mobile toggle:** Fixed bottom-left `bottom-6 left-6`, z-50, `h-12 w-12`, Button variant primary.

---

## 5. Component-Level Styles (Relevant to Home)

- **Card (ui/card):** `rounded-2xl`, transition, variants (default border gray-200/dark:border-border, shadow-md; elevated shadow-lg; etc.). CardHeader padding `p-6 md:p-8`, CardTitle `text-xl md:text-2xl font-semibold`, CardContent `p-6 md:p-8 pt-0`.
- **Button (ui/button):** `rounded-xl`, `font-bold`, transition; no `primary` in CVA—use design-system primary (e.g. gray-600 or brand) for “primary” in Figma.
- **Badge:** `rounded-full`, `px-3 py-1.5`, `text-xs font-bold`, `uppercase`, `tracking-wide`; variants map to semantic colors.

---

## 6. Typography (Base in globals.css)

- **h1:** `text-4xl font-bold tracking-tight`  
- **h2:** `text-3xl font-semibold tracking-tight`  
- **h3:** `text-2xl font-semibold`  
- **h4:** `text-xl font-medium`  
- **h5:** `text-lg font-medium`  
- **h6:** `text-base font-medium`  
- **p:** `text-base leading-7`  

Home pages use ad-hoc sizes (e.g. `text-3xl`, `text-4xl` for headings); consider a type scale in Figma.

---

## 7. Constraints for Figma

1. **RTL:** All layout and navigation are RTL.
2. **Dark theme:** Assume dark as default; semantic tokens have light and dark values.
3. **Spacing:** Use `space-y-*`, `gap-*`, `p-*` consistently; main content uses `space-y-6` to `space-y-8`, grid `gap-4` to `gap-6`.
4. **Primary CTA:** Align with `primary` in design system; in code, “primary” button may fall back to default (gray) if not extended.
5. **Customer hero gradient:** from-teal → via light-blue → to main-orange; define teal, light-blue, main-orange in Figma.
6. **Radius:** Cards and buttons use `rounded-2xl` or `rounded-xl`; badges `rounded-full`.
7. **No hard-coded widths** for content; use max-width (e.g. max-w-7xl) and padding for containment.
