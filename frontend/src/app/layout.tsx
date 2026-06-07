import "./globals.css"
import "./global-background.css"
import "./contrast-fix.css"
import { ReactNode } from "react"
import { Metadata } from "next"
import { Providers } from "../components/providers"
import { ThemeProvider } from "../lib/theme"
import { Toaster } from '../components/ui/toaster'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { registerServiceWorker } from '../lib/serviceWorker'
import { PwaInstallPromptWrapper } from '../components/PwaInstallPromptWrapper'


export const metadata: Metadata = {
  title: "آرایشگاه مردانه دوکارد",
  description: "آرایشگاه مردانه دوکارد - خدمات حرفه‌ای آرایشگری، اصلاح، رنگ مو و مراقبت از مو و پوست",
  keywords: ["آرایشگاه مردانه", "دوکارد", "اصلاح مو", "رنگ مو", "آرایشگر", "مراقبت پوست"],
  authors: [{ name: "Doocard Team" }],
  creator: "Doocard Barbershop",
  publisher: "Doocard",
  robots: "index, follow",
  metadataBase: new URL('https://www.doocardbarbershop.com'),
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico'
  },
  openGraph: {
    title: "آرایشگاه مردانه دوکارد",
    description: "آرایشگاه مردانه دوکارد - خدمات حرفه‌ای آرایشگری، اصلاح، رنگ مو و مراقبت از مو و پوست",
    type: 'website',
    locale: 'fa_IR',
    siteName: 'آرایشگاه مردانه دوکارد',
    url: 'https://www.doocardbarbershop.com'
  },
  twitter: {
    card: 'summary',
    title: 'آرایشگاه مردانه دوکارد',
    description: 'آرایشگاه مردانه دوکارد - خدمات حرفه‌ای آرایشگری، اصلاح، رنگ مو و مراقبت از مو و پوست',
    site: '@doocardsalon'
  },
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code'
  }
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: 'hsl(var(--card))',
  colorScheme: 'dark'
}

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* Favicon and Icons - High Quality */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/logo/applogo-2048.jpg" />
        <link rel="icon" type="image/jpeg" sizes="2048x2048" href="/logo/applogo-2048.jpg" />
        <link rel="icon" type="image/jpeg" sizes="4096x4096" href="/logo/applogo-4096.jpg" />
        <link rel="icon" type="image/jpeg" sizes="512x512" href="/logo/applogo-512.jpg" />

        {/* Cache Busting Meta Tags */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        
        {/* PWA Meta Tags - FORCE DARK THEME */}
        <meta name="theme-color" content="hsl(var(--card))" />
        <meta name="background-color" content="hsl(var(--card))" />
        <meta name="color-scheme" content="dark" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Doocard" />
        <meta name="application-name" content="Doocard Salon" />
        <meta name="msapplication-TileColor" content="hsl(var(--card))" />
        <meta name="msapplication-TileImage" content="/logo/applogo-2048.jpg" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* PWA Display Settings */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="apple-touch-fullscreen" content="yes" />
        
        {/* Modern Inter font for elegant typography */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        
        {/* Force dark theme styles - color-scheme only; no global color overrides */}
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body, #__next {
              color-scheme: dark !important;
            }
            *, *::before, *::after {
              color-scheme: dark !important;
            }
          `
        }} />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <ErrorBoundary>
            <Providers>
              <div className="relative flex min-h-screen flex-col">
                <div className="flex-1" data-app-wrapper="true">{children}</div>
              </div>
            </Providers>
          </ErrorBoundary>
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Force Dark Theme Script - WITHOUT background override
              (function() {
                'use strict';
                
                function forceDarkTheme() {
                  document.documentElement.style.colorScheme = 'dark';
                  document.documentElement.setAttribute('data-theme', 'dark');
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                  
                  // CRITICAL: DON'T set background-color - preserve background IMAGE
                  document.body.classList.add('dark', 'force-dark');
                  
                  const style = document.createElement('style');
                  style.textContent = \`
                    html, #__next {
                      color-scheme: dark !important;
                    }
                    
                    .bg-white, .bg-gray-50, .bg-gray-100, .bg-slate-50 {
                      background-color: hsl(var(--card)) !important;
                      color: hsl(var(--primary)) !important;
                    }
                    
                    .bg-blue-500, .bg-blue-600, .bg-indigo-500, .bg-purple-500, .bg-pink-500 {
                      background-color: hsl(var(--primary)) !important;
                      color: hsl(var(--card)) !important;
                    }
                    
                    .text-blue-500, .text-blue-600, .text-indigo-500, .text-purple-500, .text-pink-500 {
                      color: hsl(var(--primary)) !important;
                    }
                    
                    input, textarea, select {
                      background-color: hsl(var(--card)) !important;
                      color: hsl(var(--primary)) !important;
                      border-color: rgba(161, 209, 177, 0.3) !important;
                    }
                  \`;
                  
                  document.head.appendChild(style);
                  
                  document.querySelectorAll('.light').forEach(el => {
                    el.classList.remove('light');
                    el.classList.add('dark');
                  });
                  
                  let metaThemeColor = document.querySelector('meta[name="theme-color"]');
                  if (!metaThemeColor) {
                    metaThemeColor = document.createElement('meta');
                    metaThemeColor.name = 'theme-color';
                    document.head.appendChild(metaThemeColor);
                  }
                  metaThemeColor.content = 'hsl(var(--card))';
                }
                
                forceDarkTheme();
                
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', forceDarkTheme);
                } else {
                  forceDarkTheme();
                }
                
                window.addEventListener('load', forceDarkTheme);
                
                document.addEventListener('visibilitychange', function() {
                  if (!document.hidden) {
                    setTimeout(forceDarkTheme, 100);
                  }
                });
              })();
              
              // Service Worker
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('Service Worker registered successfully:', registration.scope);
                      
                      registration.addEventListener('updatefound', function() {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', function() {
                          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            if (confirm('نسخه جدیدی از اپلیکیشن موجود است. آیا می‌خواهید صفحه را بازخوانی کنید؟')) {
                              window.location.reload();
                            }
                          }
                        });
                      });
                    })
                    .catch(function(error) {
                      console.log('Service Worker registration failed:', error);
                    });
                });
              }
            `,
          }}
        />
        <Toaster />
        <PwaInstallPromptWrapper />
      </body>
    </html>
  )
}