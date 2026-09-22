'use client'

import * as React from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'

/**
 * Shared glass CTA — identical tokens to GlassChip idle/hover/focus.
 * Use GlassChip when the control is a selectable chip (aria-pressed / selected).
 */
export const GlassButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  ({ type = 'button', ...props }, ref) => {
    return <Button ref={ref} type={type} variant="glass" {...props} />
  },
)
GlassButton.displayName = 'GlassButton'
