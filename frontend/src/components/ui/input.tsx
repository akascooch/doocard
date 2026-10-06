import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const inputVariants = cva(
  "flex w-full rounded-xl border border-border bg-input text-card-foreground transition-all duration-300 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        default: "border-border hover:border-ring",
        filled: "border-border bg-card hover:border-ring",
        ghost: "border-transparent bg-transparent hover:bg-accent",
        error: "border-error focus-visible:ring-error focus-visible:border-error",
      },
      inputSize: {
        default: "h-12 px-4 py-3 text-sm",
        sm: "h-9 px-3 py-2 text-xs",
        lg: "h-14 px-6 py-4 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
)

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, inputSize, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, inputSize, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }