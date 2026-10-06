import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold transition-all duration-200 ease-out focus:outline-none uppercase tracking-wide",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-sm",
        secondary: "border-border bg-secondary text-secondary-foreground shadow-sm",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow-sm",
        success: "border-transparent bg-success text-success-foreground shadow-sm",
        warning: "border-transparent bg-warning-solid text-warning-foreground shadow-sm",
        info: "border-transparent bg-info text-info-foreground shadow-sm",
        outline: "border border-border bg-card text-card-foreground",
        glass: "border border-border bg-card text-card-foreground shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }