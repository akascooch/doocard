'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalErrorHandler() {
  const [isOnline, setIsOnline] = useState(true);
  const [wsConnected, setWsConnected] = useState(true);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [showWsDisconnectBanner, setShowWsDisconnectBanner] = useState(false);
  const [showConnectionRestoredBanner, setShowConnectionRestoredBanner] = useState(false);

  useEffect(() => {
    // Handle online/offline events
    const handleOnline = () => {
      console.log('✅ Network connection restored');
      setIsOnline(true);
      setShowOfflineBanner(false);
      
      // Only show "connection restored" if we were previously offline
      setShowConnectionRestoredBanner(true);
      setTimeout(() => {
        setShowConnectionRestoredBanner(false);
      }, 3000);
    };

    const handleOffline = () => {
      console.log('❌ Network connection lost');
      setIsOnline(false);
      setShowOfflineBanner(true);
      setShowConnectionRestoredBanner(false);
    };

    // Add listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    setIsOnline(navigator.onLine);
    if (!navigator.onLine) {
      setShowOfflineBanner(true);
    }

    // Listen for WebSocket connection events (custom events from socket store)
    const handleWsConnect = () => {
      setWsConnected(true);
      setShowWsDisconnectBanner(false);
    };

    const handleWsDisconnect = () => {
      setWsConnected(false);
      setShowWsDisconnectBanner(true);
    };

    window.addEventListener('ws-connected', handleWsConnect);
    window.addEventListener('ws-disconnected', handleWsDisconnect);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('ws-connected', handleWsConnect);
      window.removeEventListener('ws-disconnected', handleWsDisconnect);
    };
  }, []);

  // Retry is for network-offline only. Socket disconnect must NOT trigger reload or logout.
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <>
      {/* Offline Banner */}
      <AnimatePresence>
        {showOfflineBanner && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white shadow-lg"
          >
            <div className="container mx-auto px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <WifiOff className="w-5 h-5 animate-pulse" />
                  <div className="text-right">
                    <p className="font-semibold">اتصال به اینترنت قطع شده است</p>
                    <p className="text-xs opacity-90">
                      لطفاً اتصال خود را بررسی کنید. سیستم به صورت خودکار تلاش برای اتصال مجدد می‌کند...
                    </p>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="bg-white text-red-600 hover:bg-gray-100"
                >
                  <RefreshCw className="w-4 h-4 ml-2" />
                  تلاش مجدد
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WebSocket Disconnected Banner — no reload/logout; auth session remains intact */}
      <AnimatePresence>
        {!showOfflineBanner && showWsDisconnectBanner && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[9999] bg-amber-600 text-white shadow-lg"
          >
            <div className="container mx-auto px-4 py-2">
              <div className="flex items-center justify-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 animate-pulse" />
                <p>اتصال به سرور قطع شده - در حال تلاش برای برقراری مجدد...</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection Restored Banner (temporary) */}
      <AnimatePresence>
        {showConnectionRestoredBanner && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="fixed top-0 left-0 right-0 z-[9999] bg-green-600 text-white shadow-lg"
          >
            <div className="container mx-auto px-4 py-2">
              <div className="flex items-center justify-center gap-2 text-sm">
                <Wifi className="w-4 h-4" />
                <p>اتصال برقرار شد ✓</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

