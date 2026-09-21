'use client'

import { ReactNode } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '2.0.9'

type AuthSplitShellProps = {
  title: string
  subtitle: string
  heading: string
  headingHint: string
  activeStep?: 1 | 2 | 3
  children: ReactNode
}

const STEPS: { number: 1 | 2 | 3; text: string }[] = [
  { number: 1, text: 'ثبت هویت' },
  { number: 2, text: 'دریافت کد پیامک' },
  { number: 3, text: 'ورود به پنل' },
]

const heroStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
}

const heroItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  const px = compact ? 40 : 48
  return (
    <div className="flex items-center gap-3">
      <div
        className={`relative overflow-hidden rounded-2xl bg-white/5 p-1 shadow-[0_8px_32px_rgba(255,255,255,0.08)] ring-1 ring-white/20 ${
          compact ? 'h-10 w-10' : 'h-12 w-12'
        }`}
      >
        <Image
          src="/logo/logo-512.png"
          alt="Doocard"
          width={px}
          height={px}
          className="h-full w-full object-contain"
          priority
        />
      </div>
      <span className="text-lg font-semibold tracking-tight text-white sm:text-xl">
        Doocard
      </span>
    </div>
  )
}

function StepItem({
  number,
  text,
  active,
}: {
  number: number
  text: string
  active?: boolean
}) {
  return (
    <div
      className={
        active
          ? 'flex items-center gap-3 rounded-2xl border border-white bg-white px-4 py-3 text-black'
          : 'flex items-center gap-3 rounded-2xl border-none bg-[#1A1A1A] px-4 py-3 text-white'
      }
    >
      <span
        className={
          active
            ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-sm font-semibold text-white'
            : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white/40'
        }
      >
        {number}
      </span>
      <span className="text-sm font-medium tracking-tight">{text}</span>
    </div>
  )
}

export function AuthSplitShell({
  title,
  subtitle,
  heading,
  headingHint,
  activeStep = 1,
  children,
}: AuthSplitShellProps) {
  return (
    <main
      dir="ltr"
      className="aurora-auth-shell flex min-h-dvh w-full max-w-[100vw] overflow-x-hidden bg-black p-2 selection:bg-white/30 transition-all duration-500 lg:h-dvh lg:overflow-hidden lg:p-4"
    >
      <aside className="relative hidden h-full w-[52%] flex-col overflow-hidden rounded-3xl px-10 py-10 shadow-2xl lg:flex xl:px-12">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_#3a3a3a_0%,_#0a0a0a_55%,_#000_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-10 top-8 h-64 w-64 rounded-full bg-amber-200/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-10 right-0 h-72 w-72 rounded-full bg-white/5 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative z-10">
          <BrandMark />
        </div>
        <motion.div
          className="relative z-10 mt-auto w-full max-w-sm space-y-8 pb-4"
          variants={heroStagger}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={heroItem} className="space-y-3" dir="rtl">
            <h2 className="text-4xl font-medium tracking-tight text-white">
              {heading}
            </h2>
            <p className="px-1 text-sm leading-relaxed text-white/60">{headingHint}</p>
          </motion.div>
          <motion.div variants={heroItem} className="space-y-3" dir="rtl">
            {STEPS.map((step) => (
              <StepItem
                key={step.number}
                number={step.number}
                text={step.text}
                active={step.number === activeStep}
              />
            ))}
          </motion.div>
        </motion.div>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto overflow-x-hidden px-3 py-6 sm:px-8 sm:py-8 lg:justify-center lg:overflow-hidden lg:px-16 lg:py-6 xl:px-24">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-full max-w-md space-y-5 sm:max-w-xl sm:space-y-7 lg:space-y-6"
        >
          <div className="lg:hidden">
            <BrandMark compact />
          </div>
          <div dir="rtl" className="space-y-2 text-right">
            <h1 className="text-[1.65rem] font-medium tracking-tight text-white sm:text-3xl">
              {title}
            </h1>
            <p className="text-sm leading-relaxed text-zinc-400">{subtitle}</p>
          </div>
          <div dir="rtl">{children}</div>
        </motion.div>
        <p
          dir="ltr"
          className="mt-6 pb-2 text-center text-[11px] font-mono tracking-wider text-zinc-500 select-none sm:mt-8 lg:mt-6"
        >
          {`Powered by TECHOOCH • v${APP_VERSION}`}
        </p>
      </section>
    </main>
  )
}
