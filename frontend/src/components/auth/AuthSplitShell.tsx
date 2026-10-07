'use client'

import { ReactNode } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '2.0.29'

type AuthSplitShellProps = {
  title: string
  subtitle: string
  heading: string
  headingHint: string
  activeStep?: 1 | 2 | 3
  children: ReactNode
}

function BrandMark() {
  return (
    <div className="mx-auto flex w-full max-w-[11rem] flex-col items-center gap-3 text-center sm:max-w-[13rem]">
      <div className="relative h-28 w-28 overflow-hidden rounded-3xl bg-card p-2 shadow-sm ring-1 ring-border sm:h-36 sm:w-36">
        <Image
          src="/logo/doocard-mark-1024.png"
          alt="Doocard"
          width={144}
          height={144}
          className="h-full w-full object-contain"
          priority
        />
      </div>
      <span className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        Doocard
      </span>
    </div>
  )
}

export function AuthSplitShell({
  title,
  subtitle,
  children,
}: AuthSplitShellProps) {
  return (
    <main
      dir="ltr"
      className="aurora-auth-shell flex min-h-dvh w-full max-w-[100vw] items-center justify-center overflow-x-hidden bg-background p-2 text-foreground transition-all duration-500 lg:h-dvh lg:overflow-hidden lg:p-4"
    >
      <section className="flex min-h-0 w-full max-w-lg flex-col items-center overflow-y-auto overflow-x-hidden px-3 py-6 sm:px-8 sm:py-8 lg:justify-center lg:overflow-hidden lg:px-6 lg:py-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-full max-w-md space-y-5 sm:space-y-7 lg:space-y-6"
        >
          <BrandMark />
          <div dir="rtl" className="space-y-2 text-right">
            <h1 className="text-[1.65rem] font-medium tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            <p className="text-sm leading-relaxed text-foreground">{subtitle}</p>
          </div>
          <div dir="rtl">{children}</div>
        </motion.div>
        <p
          dir="ltr"
          className="mt-6 select-none pb-2 text-center font-mono text-[11px] tracking-wider text-foreground sm:mt-8 lg:mt-6"
        >
          {`Powered by TECHOOCH • v${APP_VERSION}`}
        </p>
      </section>
    </main>
  )
}
