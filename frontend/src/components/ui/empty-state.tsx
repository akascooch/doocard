import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  variant?: "default" | "compact"
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon: Icon, title, description, action, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "empty-state-doocard",
          variant === "compact" && "py-8",
          className
        )}
        {...props}
      >
        {Icon && (
          <Icon className="empty-state-doocard-icon animate-fade-in" />
        )}
        <h3 className="empty-state-doocard-title animate-fade-in-up">
          {title}
        </h3>
        {description && (
          <p className="empty-state-doocard-description animate-fade-in-up">
            {description}
          </p>
        )}
        {action && (
          <div className="animate-fade-in-up">
            {action}
          </div>
        )}
      </div>
    )
  }
)

EmptyState.displayName = "EmptyState"

export { EmptyState, type EmptyStateProps }

