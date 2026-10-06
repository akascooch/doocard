/**
 * Surface tokens for GlassChip, Button variant="glass", and GlassButton.
 * Colors resolve through the palette CSS variables. Selected ring is --ring.
 */

export const GLASS_SURFACE =
  'border-border bg-card text-card-foreground'

export const GLASS_HOVER = 'hover:border-ring hover:bg-accent hover:text-accent-foreground'

export const GLASS_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export const GLASS_SELECTED =
  'border-ring bg-accent font-semibold text-accent-foreground ring-2 ring-ring'

export const GLASS_DISABLED_CHIP =
  'cursor-not-allowed opacity-40 hover:border-border hover:bg-card'

export const GLASS_CHIP_LAYOUT =
  'glass-chip inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200'

export const GLASS_BUTTON_SURFACE = [
  'glass-button border',
  GLASS_SURFACE,
  GLASS_HOVER,
].join(' ')

export const GLASS_NAV_ACTIVE = [
  'border border-ring bg-accent text-accent-foreground font-semibold ring-2 ring-ring',
].join(' ')
