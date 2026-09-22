'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  GLASS_CHIP_LAYOUT,
  GLASS_DISABLED_CHIP,
  GLASS_FOCUS,
  GLASS_HOVER,
  GLASS_SELECTED,
  GLASS_SURFACE,
} from '@/lib/glass-tokens'

export type GlassChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean
}

export const GlassChip = React.forwardRef<HTMLButtonElement, GlassChipProps>(
  (
    {
      selected = false,
      className,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        data-chip=""
        data-glass=""
        data-selected={selected ? 'true' : 'false'}
        aria-pressed={disabled ? undefined : selected}
        disabled={disabled}
        className={cn(
          GLASS_CHIP_LAYOUT,
          GLASS_SURFACE,
          GLASS_HOVER,
          GLASS_FOCUS,
          selected && GLASS_SELECTED,
          disabled && GLASS_DISABLED_CHIP,
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  },
)
GlassChip.displayName = 'GlassChip'
