# AppLogo Component - Developer Guide

## Quick Start

```tsx
import { AppLogo } from '@/components/common/AppLogo'

// Use in your component
<AppLogo size="md" centered animated />
```

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Controls logo size |
| `centered` | `boolean` | `false` | Centers logo with mx-auto |
| `animated` | `boolean` | `true` | Enables fade-in + scale animation |
| `className` | `string` | `undefined` | Additional CSS classes |

## Size Guide

### Small (`sm`)
- **Size:** 80x80px
- **Use cases:** Sidebar, header, footer
- **Example:**
```tsx
<AppLogo size="sm" animated={false} />
```

### Medium (`md`)
- **Size:** 140px mobile, 180px desktop
- **Use cases:** Login/register forms, modals
- **Example:**
```tsx
<AppLogo size="md" centered animated />
```

### Large (`lg`)
- **Size:** 220px mobile, 280px desktop  
- **Use cases:** Hero sections, landing pages
- **Example:**
```tsx
<AppLogo size="lg" centered />
```

## Common Patterns

### Auth Pages (Login/Register)
```tsx
<div className="flex justify-center mb-4 pt-4">
  <AppLogo size="md" centered animated />
</div>
```

### Sidebar/Header
```tsx
<div className="w-10 h-10">
  <AppLogo size="sm" animated={false} />
</div>
```

### Homepage Hero
```tsx
<div className="flex items-center gap-3">
  <div className="w-12 h-12">
    <AppLogo size="sm" animated={false} />
  </div>
  <h1 className="text-2xl font-bold">Doocard</h1>
</div>
```

### Modal/Dialog
```tsx
<div className="text-center mb-6">
  <AppLogo size="md" centered animated />
  <h2>Modal Title</h2>
</div>
```

## Logo Variants

### Transparent Logos (In-App)
- **Files:** `logo-192.png`, `logo-512.png`
- **Usage:** Automatically used by AppLogo component
- **Where:** All UI elements, pages, components

### Background Logos (PWA/System)
- **Files:** `applogo-192.png`, `applogo-512.png`
- **Usage:** PWA manifest, favicons, meta tags
- **Where:** `manifest.json`, `layout.tsx`

## Animation Details

When `animated={true}`:
- **Effect:** Fade in (0 → 100% opacity) + Scale (95% → 100%)
- **Duration:** 0.8 seconds
- **Easing:** easeOut
- **Trigger:** Component mount
- **Frequency:** Once per mount (not infinite)

Disable for static logos:
```tsx
<AppLogo animated={false} />
```

## Responsive Behavior

The logo automatically adapts to viewport:

```tsx
// Mobile: max 60vw width
// Tablet/Desktop: size-specific breakpoints

sm:  max-w-[80px]
md:  max-w-[140px] sm:max-w-[180px]
lg:  max-w-[220px] sm:max-w-[280px]
```

## Best Practices

### ✅ Do's
- Use `animated={true}` for auth pages and entry points
- Use `animated={false}` for persistent UI (sidebar, header)
- Use `centered` prop when logo should be horizontally centered
- Choose appropriate size based on context

### ❌ Don'ts
- Don't animate logos in sidebars (performance)
- Don't use large sizes in compact spaces
- Don't add excessive custom styling
- Don't use img tags for logos anymore

## Examples in Codebase

| File | Usage | Props |
|------|-------|-------|
| `app/login/page.tsx` | Login form | `size="md" centered animated` |
| `app/register/page.tsx` | Register form | `size="md" centered animated` |
| `app/page.tsx` | Homepage header/footer | `size="sm" animated={false}` |
| `components/RoleBasedSidebar.tsx` | Sidebar | `size="sm" animated={false}` |

## Troubleshooting

### Logo not showing
```tsx
// ✅ Correct import
import { AppLogo } from '@/components/common/AppLogo'

// ❌ Wrong import
import { AppLogo } from '@/components/AppLogo'
```

### Animation not working
```tsx
// ✅ Ensure animated prop is true
<AppLogo animated={true} />

// ✅ Check framer-motion is installed
npm list framer-motion
```

### Size not responsive
```tsx
// ✅ Don't override with fixed width
<div className="w-full max-w-[200px]">
  <AppLogo size="md" />
</div>

// ❌ Avoid this
<div className="w-[200px]">
  <AppLogo size="md" />
</div>
```

## TypeScript Support

Fully typed with IntelliSense:

```typescript
interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  centered?: boolean;
  animated?: boolean;
  className?: string;
}
```

## Performance

- ✅ Uses Next.js `<Image>` component for optimization
- ✅ Lazy loading enabled
- ✅ Priority loading for above-fold logos
- ✅ Automatic responsive srcset generation
- ✅ Proper alt text for accessibility

## Accessibility

- `alt="Doocard Logo"` automatically applied
- Semantic HTML structure
- No layout shift (width/height specified)
- Works with screen readers

---

**Need help?** Check `LOGO_SYSTEM_REFACTOR.md` for implementation details.

