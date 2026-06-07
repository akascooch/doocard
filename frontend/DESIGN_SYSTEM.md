# Doocard Design System - Modern Elegant Theme

## Color Palette

### Primary Colors
- **Primary Background**: `#1C2529` - Dark sophisticated base
- **Accent Color**: `#A1D1B1` - Fresh, modern accent for interactive elements
- **Light Contrast**: `#FAFAFA` - Clean text and surface color

### Extended Palette
- **Card Background**: `#232D32` - Slightly lighter than primary background
- **Muted Colors**: `#2D373C` - Subtle secondary elements
- **Border Color**: `#373F46` - Subtle borders and dividers
- **Input Background**: `#2D373C` - Form input backgrounds

### Status Colors
- **Success**: `#A1D1B1` - Using accent color for consistency
- **Warning**: `#FBBF24` - Amber for warnings
- **Error**: `#EF4444` - Red for destructive actions
- **Info**: `#3B82F6` - Blue for informational content

## Typography

### Font Family
- **Primary**: Inter - Modern, clean sans-serif
- **Fallbacks**: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto

### Font Sizes
- **H1**: 2.25rem (36px) - Page titles
- **H2**: 1.875rem (30px) - Section headers
- **H3**: 1.5rem (24px) - Subsection headers
- **H4**: 1.25rem (20px) - Card titles
- **H5**: 1.125rem (18px) - Component titles
- **Body**: 1rem (16px) - Main content
- **Small**: 0.875rem (14px) - Secondary text

## Spacing System (8px Grid)

### Base Units
- **xs**: 0.25rem (4px)
- **sm**: 0.5rem (8px)
- **md**: 1rem (16px)
- **lg**: 1.5rem (24px)
- **xl**: 2rem (32px)
- **2xl**: 3rem (48px)
- **3xl**: 4rem (64px)

## Border Radius

### Consistent Rounding
- **Small**: 0.5rem (8px) - Small elements
- **Medium**: 0.75rem (12px) - Default for most components
- **Large**: 1rem (16px) - Cards and containers
- **Extra Large**: 1.25rem (20px) - Large containers

## Shadows

### Elevation Levels
- **Small**: `0 1px 2px 0 rgba(0, 0, 0, 0.15)`
- **Medium**: `0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)`
- **Large**: `0 10px 15px -3px rgba(0, 0, 0, 0.25), 0 4px 6px -2px rgba(0, 0, 0, 0.1)`
- **Glow**: `0 0 20px rgba(161, 209, 177, 0.3)` - Accent glow effect

## Glass Effects

### Backdrop Blur
- **Standard**: `blur(12px)` with `rgba(35, 45, 50, 0.8)` background
- **Light**: `blur(8px)` for mobile optimization
- **Border**: `rgba(161, 209, 177, 0.1)` subtle accent border

## Component Variants

### Buttons
- **Primary**: Gradient background with shadow
- **Secondary**: Subtle background with hover effects
- **Ghost**: Transparent with hover states
- **Glass**: Glass morphism effect
- **Gradient**: Primary to accent gradient
- **Glow**: Glowing accent effect

### Cards
- **Default**: Standard background with border
- **Glass**: Glass morphism with backdrop blur
- **Elevated**: Enhanced shadow for prominence
- **Outline**: Transparent with border accent
- **Gradient**: Subtle gradient background

### Inputs
- **Default**: Standard input styling
- **Glass**: Glass morphism effect
- **Filled**: Muted background
- **Ghost**: Transparent with hover states

## Accessibility Features

### Color Contrast
- **Primary Text**: 4.5:1 contrast ratio minimum
- **Secondary Text**: 3:1 contrast ratio minimum
- **Interactive Elements**: 3:1 contrast ratio minimum

### Focus States
- **Visible Focus**: 2px solid accent color outline
- **Focus Offset**: 2px offset for better visibility
- **Keyboard Navigation**: Full keyboard accessibility

### Motion
- **Reduced Motion**: Respects `prefers-reduced-motion`
- **Smooth Transitions**: 200ms ease-in-out for interactions
- **Hover Effects**: Subtle scale and shadow changes

## Responsive Design

### Breakpoints
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px
- **Large Desktop**: > 1400px

### Mobile Optimizations
- **Touch Targets**: Minimum 44px for interactive elements
- **Spacing**: Reduced padding and margins for mobile
- **Typography**: Slightly smaller font sizes for mobile
- **Glass Effects**: Reduced blur for performance

## Animation Guidelines

### Timing Functions
- **Standard**: `ease-in-out` for most transitions
- **Bounce**: `cubic-bezier(0.68, -0.55, 0.265, 1.55)` for playful elements
- **Smooth**: `cubic-bezier(0.4, 0, 0.2, 1)` for natural motion

### Duration
- **Quick**: 150ms - Hover states
- **Standard**: 200ms - Most interactions
- **Slow**: 300ms - Page transitions

## Usage Guidelines

### Do's
- ✅ Use consistent spacing (8px grid)
- ✅ Apply glass effects sparingly for emphasis
- ✅ Maintain high contrast ratios
- ✅ Use semantic color roles
- ✅ Provide clear focus states
- ✅ Test on multiple screen sizes

### Don'ts
- ❌ Mix different design systems
- ❌ Use low contrast color combinations
- ❌ Overuse glass effects
- ❌ Ignore accessibility requirements
- ❌ Use inconsistent border radius
- ❌ Create cluttered interfaces

## Implementation Notes

This design system is built on:
- **Tailwind CSS** for utility-first styling
- **CSS Custom Properties** for theme consistency
- **Class Variance Authority** for component variants
- **Radix UI** for accessible component primitives
- **Framer Motion** for smooth animations

The system prioritizes:
1. **Accessibility** - WCAG 2.1 AA compliance
2. **Performance** - Optimized for mobile and desktop
3. **Consistency** - Unified design language
4. **Flexibility** - Easy to extend and customize
