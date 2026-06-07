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
  
  // Size class mapping
  const sizeClasses = {
    sm: 'max-w-[80px]',
    md: 'max-w-[140px] sm:max-w-[180px]',
    lg: 'max-w-[220px] sm:max-w-[280px]'
  }

  // Image dimensions for Next.js Image component
  // Using actual source dimensions for better Next.js optimization
  const dimensions = {
    sm: { width: 2048, height: 2048 },   // High res source, scaled down by CSS
    md: { width: 2048, height: 2048 },   // High res source, scaled down by CSS
    lg: { width: 4096, height: 4096 }    // Ultra high res for large displays
  }

  const baseClasses = cn(
    'w-full h-auto object-contain',
    sizeClasses[size],
    'max-w-[60vw]', // Mobile constraint
    centered && 'mx-auto',
    className
  )

  if (animated) {
    const MotionImage = motion(Image)
    
    return (
      <MotionImage
        src={imageSrc}
        alt="Doocard Logo"
        width={dimensions[size].width}
        height={dimensions[size].height}
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
      priority
      className={baseClasses}
    />
  )
}

