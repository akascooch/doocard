'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { checkServerReachability, startConnectivityPolling } from '@/lib/offline/connectivity';
import { getOutboxSummary, subscribeOutbox } from '@/lib/offline/outbox';
import { runOfflineSync } from '@/lib/offline/sync-worker';
import { isOfflineModeEnabled } from '@/lib/offline/feature-flag';

const OFFLINE_MESSAGE =
  'اینترنت قطع است، اما می‌توانید اطلاعات را ثبت کنید. بعد از اتصال، اطلاعات با سرور همگام‌سازی می‌شود.';

export default function OfflineBanner() {
  const [serverReachable, setServerReachable] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const refreshReachability = async () => {
      const ok = await checkServerReachability();
      setServerReachable(ok);
    };

    void refreshReachability();

    const stopPolling = startConnectivityPolling(() => {
      setServerReachable(true);
      if (isOfflineModeEnabled()) {
        void runOfflineSync();
      }
    });

    return stopPolling;
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !isOfflineModeEnabled()) return;

    const refreshSummary = async () => {
      const summary = await getOutboxSummary();
      setPendingCount(summary.pending + summary.failed);
    };

    void refreshSummary();
    return subscribeOutbox(() => {
      void refreshSummary();
    });
  }, [mounted]);

  if (!mounted || serverReachable) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-[9998] bg-amber-700 text-white shadow-lg"
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-start gap-3">
            <WifiOff className="w-5 h-5 mt-0.5 shrink-0 animate-pulse" />
            <div className="text-right flex-1">
              <p className="font-semibold text-sm md:text-base">{OFFLINE_MESSAGE}</p>
              {isOfflineModeEnabled() && pendingCount > 0 && (
                <p className="text-xs opacity-90 mt-1">
                  {pendingCount} مورد در صف همگام‌سازی
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
