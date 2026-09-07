"use client"

import { ErrorBoundary } from "@/components/ErrorBoundary"
import { MapPin } from "lucide-react"

const EMBED =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4576.923143468721!2d51.41657430921262!3d35.790765659685626!2m3!1f0!2f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3f8e07007116900b%3A0x9f14de3d35145316!2sSam%20Center%20Parking!5e0!3m2!1sen!2s!4v1772003089353!5m2!1sen!2s"

const LAT = "35.790766"
const LNG = "51.416574"

const LINKS = [
  { href: `https://www.google.com/maps/search/?api=1&query=${LAT},${LNG}`, label: "Google Maps" },
  { href: `https://neshan.org/maps/@${LAT},${LNG},17z`, label: "نشان" },
  { href: `https://balad.ir/location?latitude=${LAT}&longitude=${LNG}`, label: "بلد" },
]

function DirectionLinks() {
  return (
    <div className="flex flex-wrap gap-2">
      {LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-md border border-white/20 px-4 text-sm text-white touch-manipulation hover:bg-white/10"
        >
          {link.label}
        </a>
      ))}
    </div>
  )
}

function MapFallback({ address }: { address: string }) {
  return (
    <div className="flex min-h-[220px] flex-col justify-between rounded-2xl border border-white/10 bg-[#141414] p-6">
      <div>
        <p className="mb-2 inline-flex items-center gap-2 text-xs tracking-[0.25em] text-zinc-500">
          <MapPin className="h-4 w-4" />
          موقعیت سالن
        </p>
        <p className="text-sm leading-7 text-zinc-300">{address}</p>
      </div>
      <div className="mt-6">
        <DirectionLinks />
      </div>
    </div>
  )
}

function MapEmbed({ address }: { address: string }) {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#080808]">
        <iframe
          src={EMBED}
          title="موقعیت سالن دوکارد"
          width="100%"
          height="380"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
      <p className="text-xs text-zinc-500">{address}</p>
      <DirectionLinks />
    </div>
  )
}

export function LandingMap({ address }: { address: string }) {
  const Fallback = () => <MapFallback address={address} />
  return (
    <ErrorBoundary fallback={Fallback}>
      <MapEmbed address={address} />
    </ErrorBoundary>
  )
}
