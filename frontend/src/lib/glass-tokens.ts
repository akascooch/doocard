/**
 * Canonical glass surface tokens (v2.0.9-glasschip).
 * Single source for GlassChip, Button variant="glass", and GlassButton.
 * Keep Tailwind class strings in sync with app/glass-exemptions.css CSS vars.
 */

export const GLASS_SURFACE =
  'border-white/15 bg-white/5 text-zinc-100 backdrop-blur-md'

export const GLASS_HOVER = 'hover:border-white/25 hover:bg-white/10'

export const GLASS_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950'

export const GLASS_SELECTED =
  'border-white/40 bg-white/15 font-semibold text-white ring-2 ring-amber-200/80'

/** Chip / button disabled: opacity + no hover fill change (pointer-events via disabled: on Button). */
export const GLASS_DISABLED_CHIP =
  'cursor-not-allowed opacity-40 hover:border-white/15 hover:bg-white/5'

export const GLASS_CHIP_LAYOUT =
  'glass-chip inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200'

/** Idle glass CTA classes (no selected ring — use GlassChip for toggle UX). */
export const GLASS_BUTTON_SURFACE = [
  'glass-button border',
  GLASS_SURFACE,
  GLASS_HOVER,
].join(' ')

/** Nav / selected-link glass (sidebar active). */
export const GLASS_NAV_ACTIVE = [
  'border border-white/40 bg-white/15 text-white font-semibold ring-2 ring-amber-200/80 backdrop-blur-md',
].join(' ')
