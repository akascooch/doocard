'use client';

/**
 * LEGACY file — not the live theme source of truth.
 * Live mechanism: next-themes in `frontend/src/components/providers.tsx`
 * (storage key `doocard-theme`, default dark).
 *
 * ThemeProvider is a pass-through so leftover imports do not fight next-themes.
 * ThemeToggle / useTheme delegate to next-themes.
 */

import { useTheme as useNextTheme } from 'next-themes';
import React from 'react';

export const STORAGE_KEY = 'doocard-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  return {
    theme: (theme as 'light' | 'dark' | 'system' | undefined) ?? 'dark',
    setTheme: (next: 'light' | 'dark' | 'system') => setTheme(next),
    resolvedTheme: (resolvedTheme === 'light' ? 'light' : 'dark') as 'light' | 'dark',
  };
}

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === 'system') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  const getLabel = () => {
    if (theme === 'system') return 'سیستم';
    return resolvedTheme === 'dark' ? 'تاریک' : 'روشن';
  };

  return (
    <button
      onClick={toggleTheme}
      className="btn-ghost flex items-center gap-2"
      aria-label="تغییر تم"
      title={`تم فعلی: ${getLabel()}`}
    >
      <span className="text-xl">{resolvedTheme === 'dark' ? '🌙' : '☀️'}</span>
      <span className="text-sm hidden md:inline">{getLabel()}</span>
    </button>
  );
}
