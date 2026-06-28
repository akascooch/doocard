'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import {
  checkServerReachability,
  subscribeServerReachability,
} from '@/lib/offline/connectivity';
import { isOfflineModeEnabled } from '@/lib/offline/feature-flag';
import {
  getAllOutboxItems,
  getLastSuccessfulSyncAt,
  getOutboxSummary,
  operationTypeLabel,
  retryFailedOperation,
  subscribeOutbox,
} from '@/lib/offline/outbox';
import { isSyncRunning, runOfflineSync } from '@/lib/offline/sync-worker';
import type { OfflineOutboxItem } from '@/lib/offline/types';
import { useToast } from '@/components/ui/use-toast';

export default function SyncStatusPanel() {
  const { toast } = useToast();
  const [enabled] = useState(() => isOfflineModeEnabled());
  const [serverReachable, setServerReachable] = useState<boolean | null>(null);
  const [summary, setSummary] = useState({ pending: 0, failed: 0, syncing: 0, done: 0, total: 0 });
  const [failedItems, setFailedItems] = useState<OfflineOutboxItem[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const [reachable, sum, last, all] = await Promise.all([
      checkServerReachability(),
      getOutboxSummary(),
      getLastSuccessfulSyncAt(),
      getAllOutboxItems(),
    ]);
    setServerReachable(reachable);
    setSummary(sum);
    setLastSync(last);
    setFailedItems(all.filter((i) => i.status === 'failed'));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const unsubOutbox = subscribeOutbox(() => {
      void refresh();
    });
    const unsubReach = subscribeServerReachability((ok) => {
      setServerReachable(ok);
    });
    return () => {
      unsubOutbox();
      unsubReach();
    };
  }, [enabled, refresh]);

  if (!enabled) {
    return null;
  }

  const handleManualSync = async () => {
    if (syncing || isSyncRunning()) return;
    setSyncing(true);
    try {
      const result = await runOfflineSync({ includeFailed: true });
      await refresh();
      if (result.error && result.synced === 0) {
        toast({
          variant: 'destructive',
          title: 'همگام‌سازی',
          description: result.error,
        });
        return;
      }
      toast({
        title: 'همگام‌سازی',
        description:
          result.synced > 0
            ? `${result.synced} مورد با موفقیت ارسال شد`
            : 'مورد جدیدی برای ارسال نبود',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryOne = async (id: string) => {
    await retryFailedOperation(id);
    await handleManualSync();
  };

  const canSync = summary.pending + summary.failed > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <p className="font-medium">وضعیت اتصال</p>
          <p className="text-sm text-muted-foreground">
            {serverReachable === null
              ? 'در حال بررسی...'
              : serverReachable
                ? 'آنلاین و متصل به سرور'
                : 'آفلاین / سرور در دسترس نیست'}
          </p>
        </div>
        <Icon
          name={serverReachable ? 'Wifi' : 'WifiOff'}
          size={20}
          className={serverReachable ? 'text-green-600' : 'text-amber-600'}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-muted-foreground">در انتظار</p>
          <p className="text-xl font-bold">{summary.pending}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-muted-foreground">ناموفق</p>
          <p className="text-xl font-bold text-destructive">{summary.failed}</p>
        </div>
      </div>

      {lastSync && (
        <p className="text-sm text-muted-foreground">
          آخرین همگام‌سازی موفق:{' '}
          {new Date(lastSync).toLocaleString('fa-IR')}
        </p>
      )}

      <Button
        className="w-full"
        onClick={handleManualSync}
        disabled={syncing || !canSync || serverReachable === false}
      >
        <Icon name="Upload" size={16} className="ml-2" />
        {syncing ? 'در حال ارسال...' : 'ارسال اطلاعات آفلاین به سرور'}
      </Button>

      {!serverReachable && canSync && (
        <p className="text-xs text-amber-700">
          برای ارسال دستی، ابتدا اتصال به سرور برقرار شود.
        </p>
      )}

      {failedItems.length > 0 && (
        <div className="space-y-2">
          <p className="font-medium text-sm">موارد ناموفق</p>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-right p-2">نوع</th>
                  <th className="text-right p-2">تاریخ</th>
                  <th className="text-right p-2">خطا</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {failedItems.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="p-2">{operationTypeLabel(item.type)}</td>
                    <td className="p-2 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString('fa-IR')}
                    </td>
                    <td className="p-2 text-destructive text-xs max-w-[180px] truncate">
                      {item.lastError || '—'}
                    </td>
                    <td className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleRetryOne(item.id)}
                        disabled={syncing || !serverReachable}
                      >
                        تلاش مجدد
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
