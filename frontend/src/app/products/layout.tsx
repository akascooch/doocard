import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "فروشگاه | آرایشگاه مردانه دوکارد",
  description: "محصولات مراقبت از مو و پوست سالن دوکارد",
}

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
