import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const inputVariants = cva(
  "flex w-full rounded-xl border bg-white dark:bg-input text-gray-900 dark:text-foreground transition-all duration-md ease-smooth file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 dark:placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-muted",
  {
    variants: {
      variant: {
        default: "border-gray-300 dark:border-border hover:border-gray-600 dark:hover:border-primary/50",
        filled: "bg-gray-50 dark:bg-muted border-gray-200 dark:border-transparent hover:border-gray-400 dark:hover:border-primary/30",
        ghost: "border-transparent bg-transparent hover:bg-gray-100 dark:hover:bg-muted/50",
        error: "border-red-500 dark:border-destructive focus-visible:ring-red-500 dark:focus-visible:ring-destructive",
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