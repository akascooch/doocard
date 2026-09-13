"use client"

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import { ReactNode, useEffect } from "react"

/** Same key as the previous custom ThemeProvider in lib/theme.tsx */
export const THEME_STORAGE_KEY = "doocard-theme"
const LEGACY_NEXT_THEMES_KEY = "theme"

if (typeof window !== "undefined") {
  try {
    const current = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (!current) {
      const legacy = window.localStorage.getItem(LEGACY_NEXT_THEMES_KEY)
      if (legacy && ["light", "dark", "system"].includes(legacy)) {
        window.localStorage.setItem(THEME_STORAGE_KEY, legacy)
      }
    }
  } catch {
    // private mode / quota
  }
}

function ThemeDomSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    if (!resolvedTheme) return
    const root = document.documentElement
    root.setAttribute("data-theme", resolvedTheme)
    document.body.classList.remove("force-dark")
    if (resolvedTheme === "dark") {
      document.body.classList.add("dark")
    } else {
      document.body.classList.remove("dark")
    }
  }, [resolvedTheme])

  return null
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      storageKey={THEME_STORAGE_KEY}
    >
      <ThemeDomSync />
      {children}
    </NextThemesProvider>
  )
}
