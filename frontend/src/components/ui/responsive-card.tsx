import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ResponsiveCardProps {
  children: ReactNode
  className?: string
  title?: string
  description?: string
  icon?: ReactNode
  variant?: 'default' | 'outlined' | 'elevated'
  size?: 'sm' | 'md' | 'lg'
}

export function ResponsiveCard({
  children,
  className,
  title,
  description,
  icon,
  variant = 'default',
  size = 'md'
}: ResponsiveCardProps) {
  const baseClasses = "rounded-2xl transition-all duration-300"
  
  const variantClasses = {
    default: "bg-card backdrop-blur-md border border-border text-card-foreground shadow-2xl shadow-black/40",
    outlined: "bg-transparent border-2 border-border text-foreground",
    elevated: "bg-card backdrop-blur-md border border-border text-card-foreground shadow-2xl shadow-black/40 hover:border-border hover:bg-accent"
  }
  
  const sizeClasses = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8"
  }

  return (
    <div className={cn(
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      "hover:border-border hover:bg-accent",
      className
    )}>
      {(title || description || icon) && (
        <div className="mb-4 flex items-start gap-3">
          {icon && (
            <div className="flex-shrink-0 p-2 rounded-lg border border-border bg-accent">
              <div className="w-5 h-5 text-foreground">
                {icon}
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-lg font-semibold text-foreground mb-1 tracking-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-sm text-foreground leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
      )}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  )
}
