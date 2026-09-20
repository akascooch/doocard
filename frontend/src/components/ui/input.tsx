import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const inputVariants = cva(
  "flex w-full rounded-xl border bg-white dark:bg-zinc-900/80 text-gray-900 dark:text-zinc-100 transition-all duration-300 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-white/[0.04]",
  {
    variants: {
      variant: {
        default: "border-gray-300 dark:border-white/10 hover:border-gray-600 dark:hover:border-white/20",
        filled: "bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20",
        ghost: "border-transparent bg-transparent hover:bg-gray-100 dark:hover:bg-white/[0.05]",
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