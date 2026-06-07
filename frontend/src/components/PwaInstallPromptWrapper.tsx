"use client"

import { PwaInstallPrompt } from './PWAInstallPrompt'
import { usePwaPrompt } from '@/hooks/usePwaPrompt'

export function PwaInstallPromptWrapper() {
  const {
    showInstallPrompt,
    isInstalled,
    isInstallable,
    handleInstallClick,
    handleDismiss
  } = usePwaPrompt()

  // Don't show if already installed or not installable
  if (isInstalled || !isInstallable) {
    return null
  }

  return (
    <PwaInstallPrompt
      show={showInstallPrompt}
      onInstall={handleInstallClick}
      onDismiss={handleDismiss}
    />
  )
}
