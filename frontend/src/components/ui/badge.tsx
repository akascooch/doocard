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
        outline: "border border-white/20 bg-white/5 text-zinc-200",
        glass: "bg-white/[0.04] backdrop-blur-md border border-white/10 text-zinc-100 shadow-md",
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