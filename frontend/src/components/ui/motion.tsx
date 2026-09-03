'use client';

import { motion, HTMLMotionProps, Variants } from 'framer-motion';
import React from 'react';

// Motion durations
export const DURATIONS = {
  xs: 0.12,  // 120ms
  sm: 0.18,  // 180ms
  md: 0.26,  // 260ms
  lg: 0.42,  // 420ms
  xl: 0.6,   // 600ms
} as const;

// Motion easing
export const EASING = {
  smooth: [0.16, 0.84, 0.24, 1],
  bounce: [0.68, -0.55, 0.265, 1.55],
  linear: [0, 0, 1, 1],
} as const;

// Common animation variants
export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: {
      duration: DURATIONS.md,
      ease: EASING.smooth,
    },
  },
};

export const scaleInVariants: Variants = {
  hidden: { scale: 0.95, opacity: 0 },
  visible: { 
    scale: 1,
    opacity: 1,
    transition: {
      duration: DURATIONS.md,
      ease: EASING.smooth,
    },
  },
};

export const slideInFromBottomVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0,
    opacity: 1,
    transition: {
      duration: DURATIONS.lg,
      ease: EASING.smooth,
    },
  },
};

export const slideInFromTopVariants: Variants = {
  hidden: { y: -20, opacity: 0 },
  visible: { 
    y: 0,
    opacity: 1,
    transition: {
      duration: DURATIONS.lg,
      ease: EASING.smooth,
    },
  },
};

export const slideInFromLeftVariants: Variants = {
  hidden: { x: -20, opacity: 0 },
  visible: { 
    x: 0,
    opacity: 1,
    transition: {
      duration: DURATIONS.lg,
      ease: EASING.smooth,
    },
  },
};

export const slideInFromRightVariants: Variants = {
  hidden: { x: 20, opacity: 0 },
  visible: { 
    x: 0,
    opacity: 1,
    transition: {
      duration: DURATIONS.lg,
      ease: EASING.smooth,
    },
  },
};

export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { y: 10, opacity: 0 },
  visible: { 
    y: 0,
    opacity: 1,
    transition: {
      duration: DURATIONS.md,
      ease: EASING.smooth,
    },
  },
};

// ===================================================
// ANIMATED COMPONENTS
// ===================================================

interface AnimatedDivProps extends HTMLMotionProps<'div'> {
  variant?: 'fadeIn' | 'scaleIn' | 'slideInBottom' | 'slideInTop' | 'slideInLeft' | 'slideInRight';
  children: React.ReactNode;
}

/**
 * Animated Div with preset variants
 */
export function AnimatedDiv({ variant = 'fadeIn', children, ...props }: AnimatedDivProps) {
  const variants = {
    fadeIn: fadeInVariants,
    scaleIn: scaleInVariants,
    slideInBottom: slideInFromBottomVariants,
    slideInTop: slideInFromTopVariants,
    slideInLeft: slideInFromLeftVariants,
    slideInRight: slideInFromRightVariants,
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={variants[variant]}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated Button with hover and tap effects
 */
export function AnimatedButton({ children, ...props }: HTMLMotionProps<'button'>) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: DURATIONS.xs, ease: EASING.smooth }}
      {...props}
    >
      {children}
    </motion.button>
  );
}

/**
 * Animated Card with hover effects
 */
export function AnimatedCard({ children, className = '', ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.01, boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.2)' }}
      variants={scaleInVariants}
      transition={{ duration: DURATIONS.md, ease: EASING.smooth }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated List with stagger effect
 */
export function AnimatedList({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainerVariants}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated List Item (use with AnimatedList)
 */
export function AnimatedListItem({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      variants={staggerItemVariants}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated Modal/Dialog backdrop
 */
export function AnimatedBackdrop({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATIONS.md }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated Modal/Dialog content
 */
export function AnimatedModal({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.95, opacity: 0, y: 20 }}
      transition={{ duration: DURATIONS.lg, ease: EASING.smooth }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Presence wrapper for conditional rendering with animations
 */
export { AnimatePresence } from 'framer-motion';

