import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold transition-all duration-200 ease-out focus:outline-none uppercase tracking-wide",
  {
    variants: {
      variant: {
        default: "border-transparent bg-gray-600 text-white shadow-sm",
        secondary: "border-transparent bg-brand-green-600 text-white shadow-sm",
        destructive: "border-transparent bg-red-600 text-white shadow-sm",
        success: "border-transparent bg-green-600 text-white shadow-sm",
        warning: "border-transparent bg-amber-500 text-white shadow-sm",
        info: "border-transparent bg-blue-600 text-white shadow-sm",
        outline: "border-2 border-gray-300 dark:border-border bg-white dark:bg-transparent text-gray-900 dark:text-foreground",
        glass: "bg-white/90 dark:bg-card/80 backdrop-blur-sm border border-gray-200 dark:border-border text-gray-900 dark:text-foreground shadow-md",
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