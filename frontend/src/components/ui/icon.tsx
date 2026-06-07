'use client';

import * as LucideIcons from 'lucide-react';
import { LucideProps } from 'lucide-react';

interface IconProps extends Omit<LucideProps, 'ref'> {
  name: keyof typeof LucideIcons;
  size?: number;
  className?: string;
  ariaLabel?: string;
}

/**
 * Unified Icon wrapper using lucide-react
 * Ensures consistent stroke width and sizing across the app
 * 
 * @example
 * <Icon name="Calendar" size={20} />
 * <Icon name="Check" className="text-green-500" ariaLabel="Success" />
 */
export function Icon({ 
  name, 
  size = 20, 
  strokeWidth = 2,
  className = '',
  ariaLabel,
  ...props 
}: IconProps) {
  const IconComponent = LucideIcons[name] as React.ComponentType<LucideProps>;
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in lucide-react`);
    return null;
  }
  
  return (
    <IconComponent
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
      {...props}
    />
  );
}

export default Icon;

// Icon size presets
export const IconSizes = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;
