'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

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
        data-selected={selected ? 'true' : 'false'}
        aria-pressed={disabled ? undefined : selected}
        disabled={disabled}
        className={cn(
          'glass-chip inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium backdrop-blur-md transition-all duration-200',
          'border-white/15 bg-white/5 text-zinc-100',
          'hover:border-white/25 hover:bg-white/10',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
          selected &&
            'border-white/40 bg-white/15 font-semibold text-white ring-2 ring-amber-200/80',
          disabled &&
            'cursor-not-allowed opacity-40 hover:border-white/15 hover:bg-white/5',
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
