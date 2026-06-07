import * as React from "react"
import { Input } from "./input"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "./button"
import { cn } from "@/lib/utils"

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, type, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)

    const handleTogglePassword = () => {
      console.log('Toggle password clicked, current state:', showPassword)
      setShowPassword(!showPassword)
      console.log('New state will be:', !showPassword)
    }

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          type={showPassword ? "text" : "password"}
          className={cn(
            "pr-10",
            className
          )}
          {...props}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-accent/10 rounded z-10 border border-border bg-card"
          onClick={handleTogglePassword}
          style={{ zIndex: 20 }}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>
    )
  }
)

PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
