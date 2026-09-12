import { parseShopApiError } from '@/lib/orders'

export type WaitlistSubscription = {
  id: string
  productId: number
  userId: number
  channel: 'SMS' | 'IN_APP'
  status: 'ACTIVE' | 'CANCELLED' | 'NOTIFIED'
  createdAt: string
  updatedAt: string
  cancelledAt: string | null
  notifiedAt: string | null
}

export async function subscribeToProductWaitlist(
  productId: number,
  token: string,
): Promise<WaitlistSubscription> {
  const res = await fetch('/api/public/waitlist', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ productId }),
    credentials: 'omit',
  })
  if (!res.ok) {
    const parsed = await parseShopApiError(res, 'ثبت درخواست خبررسانی ناموفق بود')
    throw new Error(parsed.message)
  }
  return (await res.json()) as WaitlistSubscription
}
