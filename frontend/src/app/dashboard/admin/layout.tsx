/**
 * Keep admin HTML documents dynamic so Next does not emit
 * `Cache-Control: s-maxage=31536000` shells that pin stale chunk maps.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function AdminSectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
