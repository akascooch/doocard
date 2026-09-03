'use client';

import { useState, useEffect } from 'react';
import { Bell, X, Check, AlertCircle, Smartphone, Monitor } from 'lucide-react';
import usePushNotifications from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
      // - permission === 'granted' but NOT subscribed => ALWAYS show
      //   (incomplete desktop/Windows setup: browser permission granted,
      //    but pushManager.subscribe never completed / never synced)
      // - dismissed flag present        => never (only when permission still default)
      // - fresh user, permission=default, not subscribed, not dismissed => show once
      if (isSubscribed || permission === 'denied') {
        setCanShow(false);
      } else if (permission === 'granted') {
        setCanShow(true);
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

  // Gating by deterministic rules in the effect above.
  if (!canShow) {
    return null;
  }

  const isIOSBrowser = deviceInfo?.platform === 'ios' && !deviceInfo?.isPWA;
  const needsPWAInstall = isIOSBrowser && !isSupported;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Centered modal */}
      <Card
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-md shadow-lg ${className}`}
      >
        <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          {deviceInfo?.platform === 'ios' ? (
            <Smartphone className="w-6 h-6 text-primary" />
          ) : deviceInfo?.platform === 'android' ? (
            <Smartphone className="w-6 h-6 text-green-600" />
          ) : (
            <Monitor className="w-6 h-6 text-blue-600" />
          )}
        </div>
        <CardTitle className="text-xl">
          {needsPWAInstall ? 'راهنمای فعال‌سازی اعلان‌ها' : 'فعال‌سازی اعلان‌ها'}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {deviceInfo && (
            <div className="text-xs mt-2 space-y-1">
              <div>{deviceInfo.browser} • {deviceInfo.osVersion} {deviceInfo.isPWA && '• PWA Mode'}</div>
            </div>
          )}
        </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
        {error && (
          <Alert variant={needsPWAInstall ? "default" : "destructive"} className={needsPWAInstall ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200" : ""}>
            <AlertCircle className={`h-4 w-4 ${needsPWAInstall ? 'text-blue-600' : ''}`} />
            <AlertDescription className="whitespace-pre-line text-sm leading-relaxed">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {testResult === 'success' && (
          <Alert className="border-green-200 bg-green-50">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
              {isSubscribed ? 'اعلان‌ها با موفقیت فعال شدند!' : 'پیام آزمایشی ارسال شد!'}
            </AlertDescription>
          </Alert>
        )}

        {testResult === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              خطا در فعال‌سازی اعلان‌ها. لطفاً دوباره تلاش کنید.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Button
            onClick={handleSubscribe}
            disabled={!isSupported || isLoading || isSubscribed}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                در حال فعال‌سازی...
              </div>
            ) : isSubscribed ? (
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                اعلان‌ها فعال هستند
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                فعال‌سازی اعلان‌ها
              </div>
            )}
          </Button>

          {isSubscribed && (
            <Button
              onClick={handleSendTest}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              ارسال پیام آزمایشی
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>• اعلان‌ها فقط برای رویدادهای مهم ارسال می‌شوند</p>
          <p>• می‌توانید در هر زمان اعلان‌ها را غیرفعال کنید</p>
          {needsPWAInstall ? (
            <p>• در آیفون، اعلان سیستمی فقط بعد از نصب روی صفحه اصلی (PWA) فعال می‌شود</p>
          ) : (
            <p>• پس از فعال‌سازی، اعلان سیستمی حتی وقتی برنامه بسته است نمایش داده می‌شود</p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleClose}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
            بستن
          </Button>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default NotificationPrompt;
