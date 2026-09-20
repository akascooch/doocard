'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Check, AlertCircle, Smartphone, Monitor } from 'lucide-react';
import usePushNotifications from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';

interface NotificationPromptProps {
  onClose?: () => void;
  className?: string;
}

const NOTIFICATION_PROMPT_DISMISSED_KEY = 'notification-prompt-dismissed';

export function NotificationPrompt({ onClose, className = '' }: NotificationPromptProps) {
  const [canShow, setCanShow] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  
  const {
    isSupported,
    isSubscribed,
    isPermissionGranted,
    isLoading,
    error,
    deviceInfo,
    subscribe,
    sendTestNotification,
  } = usePushNotifications();

  // Decide once per mount whether the prompt is allowed to show.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const dismissed = window.localStorage.getItem(NOTIFICATION_PROMPT_DISMISSED_KEY) === 'true';
      const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';

      // Truth table:
      // - already subscribed            => never
      // - permission === 'denied'       => never
      // - dismissed flag present        => never
      // - otherwise                     => show once until closed
      if (isSubscribed || permission === 'denied') {
        setCanShow(false);
      } else if (dismissed) {
        setCanShow(false);
      } else {
        setCanShow(true);
      }
    } catch {
      // On any storage/permission error, default to not showing to avoid nagging.
      setCanShow(false);
    }
  }, [isSubscribed]);

  const handleSubscribe = async () => {
    const success = await subscribe();
    if (success) {
      setTestResult('success');
      // Auto-close after successful subscription
      setTimeout(() => {
        handleClose();
      }, 2000);
    } else {
      setTestResult('error');
    }
  };

  const handleSendTest = async () => {
    const success = await sendTestNotification();
    setTestResult(success ? 'success' : 'error');
  };

  const handleClose = () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(NOTIFICATION_PROMPT_DISMISSED_KEY, 'true');
      }
    } catch {
      // ignore storage errors
    }
    setCanShow(false);
    onClose?.();
  };

  const isIOSBrowser = deviceInfo?.platform === 'ios' && !deviceInfo?.isPWA;
  const needsPWAInstall = isIOSBrowser && !isSupported;

  return (
    <AnimatePresence>
      {canShow && (
        <motion.div
          role="dialog"
          aria-modal="false"
          aria-label={needsPWAInstall ? 'راهنمای فعال‌سازی اعلان‌ها' : 'فعال‌سازی اعلان‌ها'}
          data-cy="notification-prompt"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`fixed top-20 left-4 z-40 w-[min(100%-2rem,24rem)] max-w-sm ${className}`}
          style={{ marginTop: 'env(safe-area-inset-top)' }}
        >
          <div className="rounded-2xl border border-white/10 bg-black/90 p-4 text-white shadow-2xl backdrop-blur-md selection:bg-white/30">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
                {deviceInfo?.platform === 'ios' ? (
                  <Smartphone className="h-5 w-5 text-white" />
                ) : deviceInfo?.platform === 'android' ? (
                  <Smartphone className="h-5 w-5 text-white" />
                ) : (
                  <Monitor className="h-5 w-5 text-white" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold tracking-tight">
                  {needsPWAInstall ? 'راهنمای فعال‌سازی اعلان‌ها' : 'فعال‌سازی اعلان‌ها'}
                </p>
                {deviceInfo && (
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {deviceInfo.browser} • {deviceInfo.osVersion} {deviceInfo.isPWA && '• PWA Mode'}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="بستن / بعداً"
                className="rounded-xl p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                needsPWAInstall
                  ? 'border-white/10 bg-white/5 text-white/80'
                  : 'border-red-400/20 bg-red-500/10 text-red-200'
              }`}>
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {testResult === 'success' && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{isSubscribed ? 'اعلان‌ها با موفقیت فعال شدند!' : 'پیام آزمایشی ارسال شد!'}</span>
              </div>
            )}

            {testResult === 'error' && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>خطا در فعال‌سازی اعلان‌ها. لطفاً دوباره تلاش کنید.</span>
              </div>
            )}

            <p className="mt-3 text-xs leading-relaxed text-white/50">
              {needsPWAInstall
                ? 'در آیفون، اعلان سیستمی فقط بعد از نصب روی صفحه اصلی (PWA) فعال می‌شود.'
                : 'اعلان‌ها فقط برای رویدادهای مهم ارسال می‌شوند و هر زمان قابل غیرفعال‌سازی هستند.'}
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
              <Button
                onClick={handleSubscribe}
                disabled={!isSupported || isLoading || isSubscribed}
                className="h-10 flex-1 rounded-xl border border-white bg-white text-black hover:bg-white/90"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                    در حال فعال‌سازی...
                  </span>
                ) : isSubscribed ? (
                  <span className="flex items-center justify-center gap-2">
                    <Check className="h-4 w-4" />
                    اعلان‌ها فعال هستند
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Bell className="h-4 w-4" />
                    فعال‌سازی اعلان‌ها
                  </span>
                )}
              </Button>

              <Button
                type="button"
                onClick={handleClose}
                variant="ghost"
                data-cy="notification-prompt-close"
                className="h-10 rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
              >
                بستن / بعداً
              </Button>
            </div>

            {isSubscribed && (
              <Button
                onClick={handleSendTest}
                disabled={isLoading}
                variant="outline"
                className="mt-2 h-9 w-full rounded-xl border-white/15 bg-transparent text-white/80 hover:bg-white/5 hover:text-white"
              >
                ارسال پیام آزمایشی
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default NotificationPrompt;
