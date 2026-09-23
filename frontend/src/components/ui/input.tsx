import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const inputVariants = cva(
  "flex w-full rounded-xl border bg-white/5 border-white/10 text-white dark:text-zinc-100 transition-all duration-300 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-white/[0.04]",
  {
    variants: {
      variant: {
        default: "border-white/10 hover:border-white/20",
        filled: "bg-white/[0.06] border-white/10 hover:border-white/20",
        ghost: "border-transparent bg-transparent hover:bg-white/[0.05]",
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