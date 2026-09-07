"use client"

const LAT = "35.790766"
const LNG = "51.416574"
const EMBED = `https://maps.google.com/maps?q=${LAT},${LNG}&hl=fa&z=15&output=embed`

const ACTIONS = [
  { href: `https://maps.google.com/?q=${LAT},${LNG}`, label: "گوگل مپ" },
  { href: `https://nshn.ir`, label: "نشان" },
  { href: `https://balad.ir`, label: "بلد" },
] as const

export function LandingMap({ address }: { address: string }) {
  return (
    <div className="space-y-3">
      <div className="relative h-[280px] w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 sm:h-[320px]">
        <iframe
          title="موقعیت سالن دوکارد"
          src={EMBED}
          className="h-full w-full border-0 grayscale invert contrast-125 opacity-80 transition-opacity hover:opacity-100"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <p className="text-xs text-zinc-500">{address}</p>
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map((item) => (
          <a
            key={item.label}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm text-white touch-manipulation hover:bg-zinc-800"
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  )
}
