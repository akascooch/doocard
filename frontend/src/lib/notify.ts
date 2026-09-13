import { notifyError, notifySuccess } from '../components/ui/use-toast'

/**
 * Live toast path is Radix (`components/ui/toaster.tsx` mounted in root layout).
 * Use this instead of `sonner` so messages actually render.
 */

export { notifyError, notifySuccess }

export function getApiErrorMessage(error: unknown, fallback = 'خطای نامشخص'): string {
  if (!error || typeof error !== 'object') {
    return fallback
  }
  const e = error as {
    friendlyMessage?: string
    message_fa?: string
    message?: string
    response?: { data?: { message_fa?: string; message?: string } }
  }
  return (
    e.friendlyMessage ||
    e.message_fa ||
    e.response?.data?.message_fa ||
    e.response?.data?.message ||
    e.message ||
    fallback
  )
}

/** Sonner-compatible surface for the few remaining accounting call sites. */
export const toast = Object.assign(
  (message: string) => notifySuccess(message),
  {
    success: (message: string) => notifySuccess(message),
    error: (message: string) => notifyError('خطا', message),
  },
)
