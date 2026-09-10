export const ORDER_STATUSES = [
  'PENDING_VERIFICATION',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export type ShopOrderItem = {
  id: number
  orderId: string
  productId: number
  productTitle: string
  unitPriceRial: string
  quantity: number
  lineTotalRial: string
  createdAt: string
}

export type ShopOrder = {
  id: string
  orderNumber: string
  customerName: string
  customerPhone: string
  customerAddress: string | null
  customerNotes: string | null
  totalAmountRial: string
  status: OrderStatus
  receiptImageUrl: string | null
  trackingCode: string | null
  adminNotes: string | null
  verifiedAt: string | null
  createdAt: string
  updatedAt: string
  items: ShopOrderItem[]
}

export type ShopOrderListResponse = {
  page: number
  limit: number
  total: number
  orders: ShopOrder[]
}

/** Card-to-card destination shown on public checkout. */
export const SHOP_CARD_TO_CARD = {
  isPlaceholder: false as const,
  ownerName: 'عباس میلاد',
  bankName: '',
  cardNumber: '6274881119028016',
  cardNumberDisplay: '6274-8811-1902-8016',
  instructions:
    'مبلغ سفارش را کارت‌به‌کارت کنید و تصویر رسید را در همین فرم بارگذاری کنید. پس از بررسی ادمین، وضعیت سفارش به‌روز می‌شود.',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_VERIFICATION: 'در انتظار تأیید رسید',
  PAID: 'پرداخت تأیید شد',
  PROCESSING: 'در حال آماده‌سازی',
  SHIPPED: 'ارسال شده',
  COMPLETED: 'تکمیل شده',
  CANCELLED: 'لغو شده',
}

export const ORDER_STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  PENDING_VERIFICATION: 'border-amber-400/40 bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  PAID: 'border-emerald-400/40 bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  PROCESSING: 'border-sky-400/40 bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
  SHIPPED: 'border-indigo-400/40 bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200',
  COMPLETED: 'border-zinc-400/40 bg-zinc-100 text-zinc-800 dark:bg-zinc-500/15 dark:text-zinc-200',
  CANCELLED: 'border-red-400/40 bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
}

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value)
}

export function multiplyRial(unitPriceRial: string, quantity: number): string {
  try {
    return (BigInt(unitPriceRial || '0') * BigInt(quantity)).toString()
  } catch {
    return '0'
  }
}

export function sumRial(values: string[]): string {
  try {
    return values.reduce((acc, value) => acc + BigInt(value || '0'), BigInt(0)).toString()
  } catch {
    return '0'
  }
}

export function shopApiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { message_fa?: string; message?: string | string[] } } })
    ?.response?.data
  if (typeof data?.message_fa === 'string') return data.message_fa
  if (typeof data?.message === 'string') return data.message
  if (Array.isArray(data?.message)) return data.message[0] || fallback
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export async function parseFetchError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message_fa?: string; message?: string | string[] }
    if (typeof data?.message_fa === 'string') return data.message_fa
    if (typeof data?.message === 'string') return data.message
    if (Array.isArray(data?.message)) return data.message[0] || fallback
  } catch {
    // ignore non-JSON
  }
  return fallback
}
