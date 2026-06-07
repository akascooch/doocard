import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-bold transition-all duration-md ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        default: "bg-gray-600 text-white hover:bg-gray-700 hover:scale-[1.02] hover:shadow-lg hover:shadow-glow-grey active:scale-[0.98]",
        secondary: "bg-brand-green-600 text-white hover:bg-brand-green-700 hover:scale-[1.02] hover:shadow-lg hover:shadow-glow-green active:scale-[0.98]",
        destructive: "bg-red-600 text-white hover:bg-red-700 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
        success: "bg-green-600 text-white hover:bg-green-700 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
        warning: "bg-amber-500 text-white hover:bg-amber-600 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
        outline: "border-2 border-gray-600 bg-white dark:bg-transparent text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900/20 hover:scale-[1.02] active:scale-[0.98]",
        ghost: "bg-transparent text-foreground hover:bg-muted hover:text-foreground active:scale-[0.98]",
        link: "text-gray-600 dark:text-gray-400 underline-offset-4 hover:underline",
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
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }