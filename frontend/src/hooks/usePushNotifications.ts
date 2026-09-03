import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/axios';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface DeviceInfo {
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
  browser: string;
  osVersion: string;
  isPWA: boolean;
  supportsWebPush: boolean;
  supportsNotifications: boolean;
  recommendation: string;
}

interface UsePushNotificationsReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  isPermissionGranted: boolean;
  isLoading: boolean;
  error: string | null;
  deviceInfo: DeviceInfo;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  sendTestNotification: () => Promise<boolean>;
}

const NOTIFICATION_PROMPT_DISMISSED_KEY = 'notification-prompt-dismissed';

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}

// Helper function to convert ArrayBuffer to URL-safe Base64
function arrayBufferToUrlBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Detect device and browser capabilities for push notifications
 */
function detectDevice(): DeviceInfo {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isStandalone = (window.matchMedia('(display-mode: standalone)').matches) || 
                       (window.navigator as any).standalone === true ||
                       document.referrer.includes('android-app://');
  
  // Detect iOS version (major.minor). Web Push requires installed PWA on iOS 16.4+.
  const iosMatch = ua.match(/OS (\d+)_(\d+)/);
  const iosMajor = iosMatch ? parseInt(iosMatch[1], 10) : 0;
  const iosMinor = iosMatch ? parseInt(iosMatch[2], 10) : 0;
  const iosSupportsWebPushPwa =
    iosMajor > 16 || (iosMajor === 16 && iosMinor >= 4);
  
  // Detect browser
  let browser = 'unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'safari';
  else if (ua.includes('Firefox')) browser = 'firefox';
  else if (ua.includes('Edg')) browser = 'edge';
  
  // Check support
  const supportsServiceWorker = 'serviceWorker' in navigator;
  const supportsPushManager = 'PushManager' in window;
  const supportsNotifications = 'Notification' in window;
  
  let platform: 'ios' | 'android' | 'desktop' | 'unknown' = 'unknown';
  let recommendation = '';
  let supportsWebPush = false;
  
  if (isIOS) {
    platform = 'ios';
    
    if (iosSupportsWebPushPwa) {
      if (isStandalone) {
        // iOS 16.4+ installed PWA only
        supportsWebPush = supportsServiceWorker && supportsPushManager;
        recommendation = supportsWebPush 
          ? 'سیستم شما از اعلان‌ها پشتیبانی می‌کند'
          : 'مرورگر شما نیاز به به‌روزرسانی دارد';
      } else {
        // Safari tab: Web Push is not available; must install to Home Screen
        supportsWebPush = false;
        recommendation = `اعلان‌های سیستمی آیفون فقط در حالت نصب‌شده (PWA) پشتیبانی می‌شوند، نه در تب معمولی Safari.\n\n1️⃣ از منوی Share (دکمه ↗️) گزینه «افزودن به صفحه اصلی» را انتخاب کنید\n2️⃣ آیکون Doocard را از صفحه اصلی باز کنید\n3️⃣ دوباره وارد شوید و اعلان‌ها را فعال کنید\n\n💡 در تب فعلی Safari، فقط اعلان‌های داخل برنامه (WebSocket) در دسترس هستند.`;
      }
    } else {
      // iOS < 16.4 - No Web Push support
      supportsWebPush = false;
      recommendation = `متأسفانه iOS ${iosMajor ? `${iosMajor}.${iosMinor}` : 'قدیمی'} از اعلان‌های وب پشتیبانی نمی‌کند.\n\n✅ اعلان‌های لحظه‌ای داخل برنامه (WebSocket) وقتی برنامه باز است فعال هستند.\n\n💡 برای اعلان‌های پس‌زمینه، iOS را به 16.4 یا بالاتر به‌روزرسانی کنید و اپ را به صفحه اصلی اضافه کنید.`;
    }
  } else if (isAndroid) {
    platform = 'android';
    supportsWebPush = supportsServiceWorker && supportsPushManager;
    recommendation = supportsWebPush
      ? 'سیستم شما کاملاً از اعلان‌ها پشتیبانی می‌کند'
      : 'لطفاً از Chrome یا Firefox استفاده کنید';
  } else {
    platform = 'desktop';
    supportsWebPush = supportsServiceWorker && supportsPushManager;
    recommendation = supportsWebPush
      ? 'سیستم شما کاملاً از اعلان‌ها پشتیبانی می‌کند'
      : 'لطفاً از Chrome، Firefox یا Edge استفاده کنید';
  }
  
  return {
    platform,
    browser,
    osVersion: iosMajor > 0 ? `iOS ${iosMajor}.${iosMinor}` : 'Unknown',
    isPWA: isStandalone,
    supportsWebPush,
    supportsNotifications,
    recommendation,
  };
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(detectDevice());
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getVAPIDPublicKey = useCallback(async (): Promise<string> => {
    try {
      // Try backend first
      const response = await api.get('/push-notifications/public-key');
      return response.data.publicKey;
    } catch (err) {
      // Fallback to environment variable
      const envKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (envKey) {
        console.log('ℹ️ Using VAPID key from environment');
        return envKey;
      }
      console.error('Error fetching VAPID public key:', err);
      throw new Error('VAPID public key not available');
    }
  }, []);

  const checkExistingSubscription = useCallback(async () => {
    try {
      // Check permission status
      const permission = Notification.permission;
      setIsPermissionGranted(permission === 'granted');
      
      if (permission === 'denied') {
        setError('مجوز اعلان‌ها رد شده است. لطفاً در تنظیمات مرورگر مجوز را فعال کنید.');
        return;
      }

      // Check if we have an active subscription
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      // Incomplete setup: browser already granted permission, but no PushSubscription
      // exists yet (common on Windows/desktop when the prompt was dismissed after
      // the OS permission dialog, or after a VAPID/key migration). Auto-complete.
      if (!subscription && permission === 'granted') {
        try {
          console.log('🔔 Permission granted but no subscription — completing setup');
          const vapidPublicKey = await getVAPIDPublicKey();
          const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey as BufferSource,
          });
        } catch (err) {
          console.warn('⚠️ Auto-subscribe failed (user can retry via prompt):', err);
          setIsSubscribed(false);
          return;
        }
      }
      
      if (subscription) {
        console.log('✅ Found existing push subscription');
        setIsSubscribed(true);
        
        // Verify with backend (silent - don't block UI)
        try {
          await api.post('/push-notifications/subscribe', {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: arrayBufferToUrlBase64(subscription.getKey('p256dh')!),
              auth: arrayBufferToUrlBase64(subscription.getKey('auth')!),
            },
          });
          console.log('✅ Subscription re-synced with backend');
        } catch (err) {
          console.warn('⚠️ Failed to sync subscription (will retry on next page load)');
        }
      } else {
        setIsSubscribed(false);
      }
    } catch (err) {
      console.error('Error checking subscription:', err);
      setIsSubscribed(false);
    }
  }, [getVAPIDPublicKey]);

  // Detect device capabilities
  useEffect(() => {
    const info = detectDevice();
    setDeviceInfo(info);
    
    console.log('🔍 Device Info:', info);
    
    if (!info.supportsWebPush) {
      setIsSupported(false);
      setError(info.recommendation);
      return;
    }
    
    setIsSupported(true);
    checkExistingSubscription();
  }, [checkExistingSubscription]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !deviceInfo.supportsWebPush) {
      setError(deviceInfo.recommendation);
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔔 Starting push notification subscription...');
      console.log('Device:', deviceInfo.platform, deviceInfo.browser, deviceInfo.osVersion);
      
      // Request permission
      let permission = Notification.permission;
      if (permission === 'default') {
        console.log('📢 Requesting notification permission...');
        permission = await Notification.requestPermission();
      }
      
      if (permission !== 'granted') {
        // User either dismissed or denied the permission request.
        // Persist dismissal so we don't show the custom prompt again.
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(NOTIFICATION_PROMPT_DISMISSED_KEY, 'true');
          }
        } catch {
          // ignore storage errors
        }
        setError('مجوز اعلان‌ها رد شد');
        return false;
      }

      setIsPermissionGranted(true);

      // Get or register service worker
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        console.log('📝 Registering service worker...');
        registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
      }

      // Check existing subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Get VAPID public key
        const vapidPublicKey = await getVAPIDPublicKey();
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

        // Create new subscription
        console.log('🔔 Creating new push subscription...');
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
      }

      // Send subscription to backend
      const subscriptionData: PushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToUrlBase64(subscription.getKey('p256dh')!),
          auth: arrayBufferToUrlBase64(subscription.getKey('auth')!),
        },
      };

      await api.post('/push-notifications/subscribe', subscriptionData);

      setIsSubscribed(true);
      localStorage.setItem('pushSubscription', JSON.stringify(subscriptionData));
      localStorage.setItem('pushSubscriptionDate', new Date().toISOString());
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(NOTIFICATION_PROMPT_DISMISSED_KEY, 'true');
        }
      } catch {
        // ignore storage errors
      }
      
      console.log('✅ Subscription successful!');
      return true;
    } catch (err: any) {
      console.error('❌ Error subscribing:', err);
      
      let errorMessage = 'خطا در فعال‌سازی اعلان‌ها';
      
      if (err.message?.includes('not allowed') || err.message?.includes('denied')) {
        errorMessage = 'مجوز اعلان‌ها رد شد';
      } else if (err.message?.includes('not supported')) {
        errorMessage = deviceInfo.recommendation || 'مرورگر شما پشتیبانی نمی‌کند';
      }
      
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, deviceInfo, getVAPIDPublicKey]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // Notify backend
        try {
          await api.delete('/push-notifications/unsubscribe', {
            data: { endpoint: subscription.endpoint },
          });
        } catch (err) {
          console.warn('Could not notify backend (non-critical)');
        }
      }

      setIsSubscribed(false);
      localStorage.removeItem('pushSubscription');
      localStorage.removeItem('pushSubscriptionDate');
      
      return true;
    } catch (err) {
      console.error('Error unsubscribing:', err);
      setError('خطا در لغو اشتراک');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    if (!isSubscribed) {
      setError('ابتدا باید در اعلان‌ها ثبت‌نام کنید');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      await api.post('/push-notifications/test');
      return true;
    } catch (err) {
      console.error('Error sending test notification:', err);
      setError('خطا در ارسال اعلان آزمایشی');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSubscribed]);

  return {
    isSupported,
    isSubscribed,
    isPermissionGranted,
    isLoading,
    error,
    deviceInfo,
    subscribe,
    unsubscribe,
    sendTestNotification,
  };
}

export default usePushNotifications;
