'use client';

import { api } from '@/lib/axios';
import { checkServerReachability } from './connectivity';
import { isOfflineModeEnabled } from './feature-flag';
import {
  enqueueOfflineOperation,
  getAllOutboxItems,
  markOperationDone,
  markOperationFailed,
  markOperationPending,
  markOperationSyncing,
  retryAllFailedOperations,
  setLastSuccessfulSyncAt,
} from './outbox';
import type {
  AppointmentCreatePayload,
  AppointmentCreateResult,
  AppointmentSettlePayload,
  CustomerQuickPayload,
  CustomerQuickResult,
  OfflineOutboxItem,
} from './types';

let syncInProgress = false;

function extractErrorMessage(err: unknown): string {
  const e = err as {
    response?: { status?: number; data?: { message?: string | string[] } };
    friendlyMessage?: string;
    message?: string;
  };
  const msg = e.response?.data?.message ?? e.friendlyMessage ?? e.message;
  if (Array.isArray(msg)) return msg.join('، ');
  if (typeof msg === 'string' && msg.trim()) return msg;
  return 'خطای نامشخص در همگام‌سازی';
}

function dependenciesMet(item: OfflineOutboxItem, items: OfflineOutboxItem[]): boolean {
  if (!item.dependsOn?.length) return true;
  return item.dependsOn.every((depId) => {
    const dep = items.find((i) => i.id === depId);
    return dep?.status === 'done' && dep.result !== undefined;
  });
}

function resolveCustomerId(
  payload: AppointmentCreatePayload,
  items: OfflineOutboxItem[],
): number | null {
  const ref = payload.customerRef;
  if (ref.kind === 'server') {
    return ref.customerId;
  }
  const dep = items.find((i) => i.id === ref.outboxId);
  const result = dep?.result as CustomerQuickResult | undefined;
  return result?.customerId ?? null;
}

function resolveAppointmentId(
  payload: AppointmentSettlePayload,
  items: OfflineOutboxItem[],
): number | null {
  const ref = payload.appointmentRef;
  if (ref.kind === 'server') {
    return ref.appointmentId;
  }
  const dep = items.find((i) => i.id === ref.outboxId);
  const result = dep?.result as AppointmentCreateResult | undefined;
  return result?.appointmentId ?? null;
}

async function syncCustomerQuick(item: OfflineOutboxItem): Promise<void> {
  const payload = item.payload as CustomerQuickPayload;
  const res = await api.post('/customers/quick', {
    name: payload.name,
    phone: payload.phone,
  });
  const customerId = res.data?.id;
  if (!customerId) {
    throw new Error('شناسه مشتری از سرور دریافت نشد');
  }
  await markOperationDone(item.id, { customerId: Number(customerId) });
}

async function syncAppointmentCreate(
  item: OfflineOutboxItem,
  items: OfflineOutboxItem[],
): Promise<void> {
  const payload = item.payload as AppointmentCreatePayload;
  const customerId = resolveCustomerId(payload, items);
  if (!customerId) {
    throw new Error('مشتری وابسته هنوز همگام‌سازی نشده است');
  }

  const body = {
    clientOpId: payload.clientOpId,
    customerId,
    employeeId: payload.employeeId,
    services: payload.services,
    jalaliDate: payload.jalaliDate,
    time: payload.time,
    notes: payload.notes,
  };

  const res = await api.post('/appointments', body);
  const appointmentId = res.data?.id;
  if (!appointmentId) {
    throw new Error('شناسه نوبت از سرور دریافت نشد');
  }
  await markOperationDone(item.id, { appointmentId: Number(appointmentId) });
}

async function syncAppointmentSettle(
  item: OfflineOutboxItem,
  items: OfflineOutboxItem[],
): Promise<void> {
  const payload = item.payload as AppointmentSettlePayload;
  const appointmentId = resolveAppointmentId(payload, items);
  if (!appointmentId) {
    throw new Error('نوبت وابسته هنوز همگام‌سازی نشده است');
  }

  const settleBody = {
    amount: payload.amount,
    tipAmount: 0,
    paymentMethod: 'CASH' as const,
    accountId: payload.accountId,
    notes: payload.notes,
    externalRef: payload.externalRef,
  };

  await api.post(`/appointments/${appointmentId}/settle`, settleBody);
  await markOperationDone(item.id, { appointmentId });
}

async function syncOneItem(item: OfflineOutboxItem, items: OfflineOutboxItem[]): Promise<void> {
  await markOperationSyncing(item.id);
  try {
    switch (item.type) {
      case 'CUSTOMER_QUICK':
        await syncCustomerQuick(item);
        break;
      case 'APPOINTMENT_CREATE':
        await syncAppointmentCreate(item, items);
        break;
      case 'APPOINTMENT_SETTLE':
        await syncAppointmentSettle(item, items);
        break;
      default:
        throw new Error('نوع عملیات ناشناخته');
    }
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    const message = extractErrorMessage(err);

    if (status === 401) {
      await markOperationFailed(item.id, 'نشست منقضی شده — لطفاً دوباره وارد شوید');
      throw err;
    }

    if (status === 409) {
      await markOperationFailed(item.id, `تداخل: ${message}`);
      return;
    }

    if (status === 400 || status === 403 || status === 404) {
      await markOperationFailed(item.id, message);
      return;
    }

    // Network or 5xx — retryable
    await markOperationPending(item.id, message);
    throw err;
  }
}

export async function runOfflineSync(options?: {
  includeFailed?: boolean;
}): Promise<{ synced: number; stopped: boolean; error?: string }> {
  if (!isOfflineModeEnabled()) {
    return { synced: 0, stopped: true, error: 'حالت آفلاین غیرفعال است' };
  }

  if (syncInProgress) {
    return { synced: 0, stopped: true, error: 'همگام‌سازی در حال اجراست' };
  }

  const reachable = await checkServerReachability();
  if (!reachable) {
    return { synced: 0, stopped: true, error: 'سرور در دسترس نیست' };
  }

  syncInProgress = true;
  let synced = 0;

  try {
    if (options?.includeFailed) {
      await retryAllFailedOperations();
    }

    let progress = true;
    while (progress) {
      progress = false;
      const items = await getAllOutboxItems();
      const queue = items
        .filter((i) => i.status === 'pending')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      for (const item of queue) {
        const freshItems = await getAllOutboxItems();
        const fresh = freshItems.find((i) => i.id === item.id);
        if (!fresh || fresh.status !== 'pending') continue;
        if (!dependenciesMet(fresh, freshItems)) continue;

        try {
          await syncOneItem(fresh, freshItems);
          synced += 1;
          progress = true;
        } catch {
          // stop batch on network failure
          return { synced, stopped: true };
        }
      }
    }

    if (synced > 0) {
      await setLastSuccessfulSyncAt(new Date().toISOString());
    }

    return { synced, stopped: false };
  } finally {
    syncInProgress = false;
  }
}

export function isSyncRunning(): boolean {
  return syncInProgress;
}

/** Enqueue helpers */
export async function queueCustomerQuick(payload: CustomerQuickPayload) {
  return enqueueOfflineOperation({
    type: 'CUSTOMER_QUICK',
    payload,
    idempotencyKey: `customer:${payload.phone.trim()}`,
  });
}

export async function queueAppointmentCreate(
  payload: AppointmentCreatePayload,
  dependsOn?: string[],
) {
  return enqueueOfflineOperation({
    type: 'APPOINTMENT_CREATE',
    payload,
    dependsOn,
    idempotencyKey: payload.clientOpId,
  });
}

export async function queueAppointmentSettle(
  payload: AppointmentSettlePayload,
  dependsOn?: string[],
) {
  return enqueueOfflineOperation({
    type: 'APPOINTMENT_SETTLE',
    payload,
    dependsOn,
    idempotencyKey: payload.externalRef,
  });
}

export async function shouldUseOfflineQueue(): Promise<boolean> {
  if (!isOfflineModeEnabled()) return false;
  return !(await checkServerReachability());
}
