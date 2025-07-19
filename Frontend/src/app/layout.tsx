import "./globals.css"
import { ReactNode } from "react"
import { Metadata } from "next"
import { Providers } from "../components/providers"
import { Toaster } from '../components/ui/toaster'
import Image from 'next/image'

export const metadata: Metadata = {
  title: "مدیریت آرایشگاه",
  description: "سیستم مدیریت نوبت‌دهی و خدمات آرایشگاه",
}

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        {/* فونت Vazirmatn مینیمال و حرفه‌ای از Google Fonts */}
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-vazirmatn tabular-nums lining-nums" suppressHydrationWarning>
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
          </div>
        </Providers>
        <Toaster />
        <div className="fixed top-4 left-4">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
            B
          </div>
        </div>
      </body>
    </html>
  )
}
