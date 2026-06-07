"use client"

import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/use-toast'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePwaPrompt() {
  const { toast } = useToast()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isInstallable, setIsInstallable] = useState(false)

  useEffect(() => {
    // Check if app is already installed
    const checkIfInstalled = () => {
      // Check for standalone mode (PWA is installed)
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true)
        return true
      }
      
      // Check for iOS Safari
      if ((window.navigator as any).standalone === true) {
        setIsInstalled(true)
        return true
      }
      
      return false
    }

    // Check if already dismissed or installed
    const hasBeenDismissed = localStorage.getItem('pwa-install-dismissed')
    const isAlreadyInstalled = checkIfInstalled()

    if (isAlreadyInstalled || hasBeenDismissed) {
      setIsInstalled(true)
      return
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      setDeferredPrompt(promptEvent)
      setIsInstallable(true)
      
      // Show prompt after a short delay for better UX
      setTimeout(() => {
        setShowInstallPrompt(true)
      }, 2000)
    }

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
      localStorage.setItem('pwa-install-dismissed', 'true')
      
      // Show success toast
      toast({
        title: '✅ نصب موفق',
        description: 'Doocard با موفقیت نصب شد!',
      })
      
      console.log('✅ PWA installed successfully!')
    }

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    try {
      // Show the install prompt
      await deferredPrompt.prompt()
      
      // Wait for the user to respond
      const { outcome } = await deferredPrompt.userChoice
      
      if (outcome === 'accepted') {
        console.log('✅ User accepted the install prompt')
        setIsInstalled(true)
        localStorage.setItem('pwa-install-dismissed', 'true')
      } else {
        console.log('❌ User dismissed the install prompt')
        localStorage.setItem('pwa-install-dismissed', 'true')
      }
      
      // Clear the deferred prompt
      setDeferredPrompt(null)
      setShowInstallPrompt(false)
    } catch (error) {
      console.error('Error showing install prompt:', error)
    }
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  return {
    showInstallPrompt,
    isInstalled,
    isInstallable,
    handleInstallClick,
    handleDismiss
  }
}
