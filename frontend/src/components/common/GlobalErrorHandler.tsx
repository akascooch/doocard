'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, AlertCircle } from 'lucide-react';
import OfflineBanner from '@/components/offline/OfflineBanner';
import { checkServerReachability, startConnectivityPolling } from '@/lib/offline/connectivity';
import { isOfflineModeEnabled } from '@/lib/offline/feature-flag';
import { runOfflineSync } from '@/lib/offline/sync-worker';

export default function GlobalErrorHandler() {
  const [showWsDisconnectBanner, setShowWsDisconnectBanner] = useState(false);
  const [showConnectionRestoredBanner, setShowConnectionRestoredBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleWsConnect = () => {
      setShowWsDisconnectBanner(false);
    };

    const handleWsDisconnect = () => {
      setShowWsDisconnectBanner(true);
    };

    window.addEventListener('ws-connected', handleWsConnect);
    window.addEventListener('ws-disconnected', handleWsDisconnect);

    return () => {
      window.removeEventListener('ws-connected', handleWsConnect);
      window.removeEventListener('ws-disconnected', handleWsDisconnect);
    };
  }, []);

  useEffect(() => {
    const stopPolling = startConnectivityPolling(async () => {
      if (wasOffline) {
        setShowConnectionRestoredBanner(true);
        setTimeout(() => setShowConnectionRestoredBanner(false), 3000);
      }
      setWasOffline(false);
      if (isOfflineModeEnabled()) {
        await runOfflineSync();
      }
    });

    const trackOffline = async () => {
      const ok = await checkServerReachability();
      if (!ok) setWasOffline(true);
    };

    void trackOffline();
    window.addEventListener('offline', trackOffline);

    return () => {
      stopPolling();
      window.removeEventListener('offline', trackOffline);
    };
  }, [wasOffline]);

  return (
    <>
      <OfflineBanner />

      <AnimatePresence>
        {showWsDisconnectBanner && !showConnectionRestoredBanner && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[9997] bg-amber-600 text-white shadow-lg"
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
