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
  const baseClasses = "rounded-xl transition-all duration-200"
  
  const variantClasses = {
    default: "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
    outlined: "bg-transparent border-2 border-gray-200 dark:border-gray-700",
    elevated: "bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700"
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
      "hover:shadow-md dark:hover:shadow-gray-900/20",
      className
    )}>
      {(title || description || icon) && (
        <div className="mb-4 flex items-start gap-3">
          {icon && (
            <div className="flex-shrink-0 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <div className="w-5 h-5 text-blue-600 dark:text-blue-400">
                {icon}
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
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
