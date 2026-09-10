'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg'
  centered?: boolean
  animated?: boolean
  className?: string
  priority?: boolean
}

const IMAGE_SRC = '/images/mainlogo.png'

export function AppLogo({ 
  size = 'md', 
  centered = false, 
  animated = true,
  className,
  priority = true,
}: AppLogoProps) {
  // Display dimensions match the intended CSS box (1:1 source is 1024×1024)
  // so next/image does not reserve the file's intrinsic pixel width in flex layouts.
  const dimensions = {
    sm: { width: 48, height: 48 },
    md: { width: 180, height: 180 },
    lg: { width: 280, height: 280 },
  }

  const sizeClasses = {
    sm: 'h-full w-full max-h-12 max-w-12',
    md: 'max-w-[140px] sm:max-w-[180px]',
    lg: 'max-w-[220px] sm:max-w-[280px]',
  }

  const sizesAttr =
    size === 'sm' ? '48px' : size === 'md' ? '(max-width: 640px) 140px, 180px' : '(max-width: 640px) 220px, 280px'

  const baseClasses = cn(
    'block aspect-square h-auto w-full max-w-full min-w-0 shrink-0 object-contain object-center',
    sizeClasses[size],
    centered && 'mx-auto',
    className
  )

  if (animated) {
    const MotionImage = motion.create(Image)
    
    return (
      <MotionImage
        src={IMAGE_SRC}
        alt="Doocard Logo"
        width={dimensions[size].width}
        height={dimensions[size].height}
        sizes={sizesAttr}
        priority={priority}
        className={baseClasses}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    )
  }

  return (
    <Image
      src={IMAGE_SRC}
      alt="Doocard Logo"
      width={dimensions[size].width}
      height={dimensions[size].height}
      sizes={sizesAttr}
      priority={priority}
      className={baseClasses}
    />
  )
}

