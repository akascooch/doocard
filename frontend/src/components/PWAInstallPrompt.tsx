"use client"

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { X, Smartphone, Download } from 'lucide-react'

interface PwaInstallPromptProps {
  show: boolean
  onInstall: () => void
  onDismiss: () => void
}

export function PwaInstallPrompt({ show, onInstall, onDismiss }: PwaInstallPromptProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (show) {
      setIsVisible(true)
      // Auto dismiss after 15 seconds
      const timer = setTimeout(() => {
        handleDismiss()
      }, 15000)
      
      return () => clearTimeout(timer)
    }
  }, [show])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(() => {
      onDismiss()
    }, 300)
  }

  const handleInstall = () => {
    onInstall()
    handleDismiss()
  }

  return (
    <AnimatePresence>
      {show && isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ 
            duration: 0.2,
            ease: "easeOut",
          }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleDismiss}
            aria-hidden="true"
          />

          {/* Centered modal */}
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-foreground font-bold text-sm">نصب Doocard</h3>
                  <p className="text-gray-400 text-xs">نسخه وب اپلیکیشن</p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="mb-4">
                <h4 className="text-white font-semibold text-sm mb-2">
                  🚀 تجربه بهتر با اپلیکیشن
                </h4>
                <ul className="text-gray-300 text-xs space-y-1">
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-primary rounded-full"></span>
                    دسترسی سریع از صفحه اصلی
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-primary rounded-full"></span>
                    عملکرد بهتر و سریع‌تر
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-primary rounded-full"></span>
                    کار آفلاین
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-primary rounded-full"></span>
                    نوتیفیکیشن‌های فوری
                  </li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={handleInstall}
                  className="flex-1 bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary text-black font-semibold text-sm h-10 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Download className="w-4 h-4 ml-2" />
                  📲 نصب Doocard
                </Button>
                <Button
                  onClick={handleDismiss}
                  variant="outline"
                  className="px-4 border-border text-muted-foreground hover:bg-muted hover:text-foreground h-10 rounded-xl transition-all duration-200"
                >
                  لغو
                </Button>
              </div>
            </div>

            {/* Progress bar */}
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 15, ease: "linear" }}
              className="h-1 bg-gradient-to-r from-primary to-secondary"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}