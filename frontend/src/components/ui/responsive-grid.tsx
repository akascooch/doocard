import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ResponsiveGridProps {
  children: ReactNode
  className?: string
  cols?: {
    xs?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
    '2xl'?: number
  }
  gap?: 'sm' | 'md' | 'lg' | 'xl'
  autoFit?: boolean
  minWidth?: string
}

export function ResponsiveGrid({
  children,
  className,
  cols = {
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 5,
    '2xl': 6
  },
  gap = 'md',
  autoFit = false,
  minWidth = '280px'
}: ResponsiveGridProps) {
  const gapClasses = {
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8'
  }

  if (autoFit) {
    return (
      <div className={cn(
        "grid",
        gapClasses[gap],
        className
      )}
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, 1fr))`
      }}>
        {children}
      </div>
    )
  }

  const gridCols = {
    'grid-cols-1': cols.xs === 1,
    'sm:grid-cols-2': cols.sm === 2,
    'md:grid-cols-3': cols.md === 3,
    'lg:grid-cols-4': cols.lg === 4,
    'xl:grid-cols-5': cols.xl === 5,
    '2xl:grid-cols-6': cols['2xl'] === 6,
  }

  const activeCols = Object.entries(gridCols)
    .filter(([_, isActive]) => isActive)
    .map(([className]) => className)

  return (
    <div className={cn(
      "grid grid-cols-1",
      activeCols,
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  )
}
