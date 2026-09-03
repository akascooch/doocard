'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg'
  centered?: boolean
  animated?: boolean
  className?: string
}

export function AppLogo({ 
  size = 'md', 
  centered = false, 
  animated = true,
  className 
}: AppLogoProps) {
  
  // Determine image source based on size - using high quality images
  const imageSrc = size === 'lg' 
    ? '/logo/logo-4096.png'  // 4096px for large (best quality)
    : size === 'md' 
      ? '/logo/logo-2048.png'  // 2048px for medium
      : '/logo/logo-2048.png'  // 2048px for small (better quality than before)
  
  // Display dimensions — must match rendered size so production flex layout
  // does not reserve 2048px intrinsic width from next/image width/height props.
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
    'block h-auto w-full max-w-full min-w-0 shrink-0 object-contain',
    sizeClasses[size],
    centered && 'mx-auto',
    className
  )

  if (animated) {
    const MotionImage = motion.create(Image)
    
    return (
      <MotionImage
        src={imageSrc}
        alt="Doocard Logo"
        width={dimensions[size].width}
        height={dimensions[size].height}
        sizes={sizesAttr}
        priority
        className={baseClasses}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    )
  }

  return (
    <Image
      src={imageSrc}
      alt="Doocard Logo"
      width={dimensions[size].width}
      height={dimensions[size].height}
      sizes={sizesAttr}
      priority
      className={baseClasses}
    />
  )
}

