"use client"

import { useRef } from "react"

export type LandingSlide = {
  id: number
  imageUrl: string
  title?: string | null
  subtitle?: string | null
}

export function LandingCarousel({ slides }: { slides: LandingSlide[] }) {
  const scroller = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startX: number; scroll: number; active: boolean }>({
    startX: 0,
    scroll: 0,
    active: false,
  })

  if (!slides.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-[#080808] text-sm text-zinc-500">
        گالری به‌زودی از پنل مدیریت تکمیل می‌شود.
      </div>
    )
  }

  return (
    <div
      ref={scroller}
      className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 cursor-grab active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      onPointerDown={(e) => {
        drag.current = {
          startX: e.clientX,
          scroll: scroller.current?.scrollLeft ?? 0,
          active: true,
        }
        scroller.current?.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drag.current.active || !scroller.current) return
        scroller.current.scrollLeft = drag.current.scroll - (e.clientX - drag.current.startX)
      }}
      onPointerUp={() => {
        drag.current.active = false
      }}
      onPointerCancel={() => {
        drag.current.active = false
      }}
    >
      {slides.map((slide) => (
        <article
          key={slide.id}
          className="relative h-64 w-[min(88vw,420px)] shrink-0 snap-center overflow-hidden rounded-2xl border border-white/10 bg-[#080808] sm:h-80 sm:w-[480px]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.imageUrl}
            alt={slide.title || "Doocard gallery"}
            className="h-full w-full object-cover"
            draggable={false}
          />
          {(slide.title || slide.subtitle) && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-5">
              {slide.title && (
                <h3 className="text-lg font-semibold tracking-wide text-white">{slide.title}</h3>
              )}
              {slide.subtitle && (
                <p className="mt-1 text-sm text-zinc-300">{slide.subtitle}</p>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  )
}
