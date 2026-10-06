import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { GLASS_BUTTON_SURFACE } from "@/lib/glass-tokens"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-bold transition-all duration-md ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        default: "border border-border bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]",
        primary: "border border-border bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]",
        secondary: "border border-border bg-secondary text-secondary-foreground hover:bg-accent hover:scale-[1.02] active:scale-[0.98]",
        destructive: "border border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:scale-[1.02] active:scale-[0.98]",
        success: "border border-success bg-success text-success-foreground hover:bg-success/90 hover:scale-[1.02] active:scale-[0.98]",
        warning: "border border-warning bg-warning text-warning-foreground hover:bg-warning/90 hover:scale-[1.02] active:scale-[0.98]",
        outline: "border-2 border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground hover:scale-[1.02] active:scale-[0.98]",
        ghost: "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
        link: "text-foreground underline-offset-4 hover:underline",
        /** Canonical glass CTA — tokens from @/lib/glass-tokens. */
        glass: `${GLASS_BUTTON_SURFACE} font-semibold hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60`,
      },
      size: {
        default: "h-12 px-6 py-3 text-sm md:text-base",
        sm: "h-9 px-4 py-2 text-xs md:text-sm",
        lg: "h-14 px-8 py-4 text-base md:text-lg",
        xl: "h-16 px-10 py-5 text-lg md:text-xl",
        icon: "h-12 w-12",
        "icon-sm": "h-9 w-9",
        "icon-lg": "h-14 w-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const computedClassName = cn(buttonVariants({ variant, size }), className)
    const isGradientLike =
      typeof className === "string" &&
      (className.includes("bg-gradient") ||
        className.includes("doocard-gradient") ||
        className.includes("from-primary") ||
        className.includes("from-secondary"))
    const finalClassName = isGradientLike ? cn(computedClassName, "text-card-foreground") : computedClassName
    const isGlass = variant === "glass"
    return (
      <Comp
        className={finalClassName}
        ref={ref}
        data-glass={isGlass ? "" : undefined}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
