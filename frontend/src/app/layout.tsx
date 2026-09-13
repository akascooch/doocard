import "./globals.css"
import "./global-background.css"
import "./contrast-fix.css"
import { ReactNode } from "react"
import { Metadata } from "next"
import { Providers } from "../components/providers"
import { Toaster } from '../components/ui/toaster'
import { ErrorBoundary } from '../components/ErrorBoundary'

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
        
        {/* PWA Meta Tags — default dark; next-themes updates color-scheme at runtime */}
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
        
        {/* Inter is loaded via globals.css @import so App Router does not emit a per-page font link. */}
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ErrorBoundary>
          <Providers>
            <div className="relative flex min-h-screen flex-col">
              <div className="flex-1" data-app-wrapper="true">{children}</div>
            </div>
            <Toaster />
          </Providers>
        </ErrorBoundary>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                'use strict';
                try {
                  var stored = localStorage.getItem('doocard-theme') || localStorage.getItem('theme');
                  var resolved;
                  if (stored === 'light' || stored === 'dark') {
                    resolved = stored;
                  } else if (stored === 'system') {
                    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  } else {
                    resolved = 'dark';
                  }
                  document.documentElement.setAttribute('data-theme', resolved);
                  document.documentElement.classList.toggle('dark', resolved === 'dark');
                  document.documentElement.style.colorScheme = resolved;
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                  document.documentElement.classList.add('dark');
                }

                if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js')
                      .then(function(registration) {
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
              })();
            `,
          }}
        />
      </body>
    </html>
  )
}