'use client';

import {
  META_STORE,
  OUTBOX_STORE,
  withStore,
} from './db';
import type {
  OfflineOperationPayload,
  OfflineOperationResult,
  OfflineOperationStatus,
  OfflineOperationType,
  OfflineOutboxItem,
  OutboxSummary,
} from './types';

type OutboxListener = () => void;
const listeners = new Set<OutboxListener>();

export function subscribeOutbox(listener: OutboxListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyOutboxChanged(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // ignore
    }
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function getAllOutboxItems(): Promise<OfflineOutboxItem[]> {
  return withStore<OfflineOutboxItem[]>(OUTBOX_STORE, 'readonly', (store) => {
    const req = store.getAll();
    return req;
  });
}

export async function getOutboxItem(id: string): Promise<OfflineOutboxItem | undefined> {
  return withStore<OfflineOutboxItem | undefined>(OUTBOX_STORE, 'readonly', (store) =>
    store.get(id),
  );
}

async function findActiveDuplicateByIdempotencyKey(
  idempotencyKey: string,
): Promise<OfflineOutboxItem | undefined> {
  const all = await getAllOutboxItems();
  return all.find(
    (item) =>
      item.idempotencyKey === idempotencyKey &&
      (item.status === 'pending' || item.status === 'syncing' || item.status === 'failed'),
  );
}

export async function enqueueOfflineOperation(input: {
  type: OfflineOperationType;
  payload: OfflineOperationPayload;
  dependsOn?: string[];
  idempotencyKey?: string;
  id?: string;
}): Promise<OfflineOutboxItem> {
  if (input.idempotencyKey) {
    const duplicate = await findActiveDuplicateByIdempotencyKey(input.idempotencyKey);
    if (duplicate) {
      return duplicate;
    }
  }

  const item: OfflineOutboxItem = {
    id: input.id ?? crypto.randomUUID(),
    type: input.type,
    payload: input.payload,
    status: 'pending',
    attempts: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    dependsOn: input.dependsOn,
    idempotencyKey: input.idempotencyKey,
  };

  await withStore(OUTBOX_STORE, 'readwrite', (store) => store.put(item));
  notifyOutboxChanged();
  return item;
}

export async function getPendingOfflineOperations(): Promise<OfflineOutboxItem[]> {
  const all = await getAllOutboxItems();
  return all
    .filter((i) => i.status === 'pending' || i.status === 'failed')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getOutboxSummary(): Promise<OutboxSummary> {
  const all = await getAllOutboxItems();
  return {
    pending: all.filter((i) => i.status === 'pending').length,
    failed: all.filter((i) => i.status === 'failed').length,
    syncing: all.filter((i) => i.status === 'syncing').length,
    done: all.filter((i) => i.status === 'done').length,
    total: all.length,
  };
}

export async function hasPendingOutboxItems(): Promise<boolean> {
  const summary = await getOutboxSummary();
  return summary.pending > 0 || summary.failed > 0 || summary.syncing > 0;
}

async function updateItem(
  id: string,
  patch: Partial<OfflineOutboxItem>,
): Promise<void> {
  const existing = await getOutboxItem(id);
  if (!existing) return;
  const updated: OfflineOutboxItem = {
    ...existing,
    ...patch,
    updatedAt: nowIso(),
  };
  await withStore(OUTBOX_STORE, 'readwrite', (store) => store.put(updated));
  notifyOutboxChanged();
}

export async function markOperationSyncing(id: string): Promise<void> {
  const item = await getOutboxItem(id);
  if (!item) return;
  await updateItem(id, {
    status: 'syncing',
    attempts: item.attempts + 1,
  });
}

export async function markOperationDone(
  id: string,
  result: OfflineOperationResult,
): Promise<void> {
  await updateItem(id, { status: 'done', result, lastError: undefined });
}

export async function markOperationFailed(id: string, error: string): Promise<void> {
  await updateItem(id, { status: 'failed', lastError: error });
}

export async function markOperationPending(id: string, error?: string): Promise<void> {
  await updateItem(id, {
    status: 'pending',
    lastError: error,
  });
}

export async function retryFailedOperation(id: string): Promise<void> {
  await updateItem(id, { status: 'pending', lastError: undefined });
}

export async function retryAllFailedOperations(): Promise<number> {
  const all = await getAllOutboxItems();
  const failed = all.filter((i) => i.status === 'failed');
  for (const item of failed) {
    await retryFailedOperation(item.id);
  }
  return failed.length;
}

export async function getLastSuccessfulSyncAt(): Promise<string | null> {
  const val = await withStore<{ key: string; value: string } | undefined>(
    META_STORE,
    'readonly',
    (store) => store.get('lastSuccessfulSyncAt'),
  );
  return val?.value ?? null;
}

export async function setLastSuccessfulSyncAt(iso: string): Promise<void> {
  await withStore(META_STORE, 'readwrite', (store) =>
    store.put({ key: 'lastSuccessfulSyncAt', value: iso }),
  );
  notifyOutboxChanged();
}

export function operationTypeLabel(type: OfflineOperationType): string {
  switch (type) {
    case 'CUSTOMER_QUICK':
      return 'ثبت مشتری';
    case 'APPOINTMENT_CREATE':
      return 'ثبت نوبت';
    case 'APPOINTMENT_SETTLE':
      return 'تسویه نقدی';
    default:
      return type;
  }
}

export function isTerminalStatus(status: OfflineOperationStatus): boolean {
  return status === 'done';
}
