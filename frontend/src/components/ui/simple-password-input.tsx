import * as React from "react"
import { Input } from "./input"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SimplePasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

const SimplePasswordInput = React.forwardRef<HTMLInputElement, SimplePasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          type={showPassword ? "text" : "password"}
          className={cn(
            "pl-10",
            className
          )}
          {...props}
        />
        <div
          className="absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          onClick={() => {
            console.log('Eye clicked, current state:', showPassword)
            setShowPassword(!showPassword)
          }}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </div>
      </div>
    )
  }
)

SimplePasswordInput.displayName = "SimplePasswordInput"

export { SimplePasswordInput } 