'use client';

import { REFERENCE_CACHE_STORE, withStore } from './db';

interface CacheEntry<T> {
  key: string;
  data: T;
  cachedAt: string;
}

export async function setReferenceCache<T>(key: string, data: T): Promise<void> {
  const entry: CacheEntry<T> = {
    key,
    data,
    cachedAt: new Date().toISOString(),
  };
  await withStore(REFERENCE_CACHE_STORE, 'readwrite', (store) => store.put(entry));
}

export async function getReferenceCache<T>(key: string): Promise<CacheEntry<T> | null> {
  const entry = await withStore<CacheEntry<T> | undefined>(
    REFERENCE_CACHE_STORE,
    'readonly',
    (store) => store.get(key),
  );
  return entry ?? null;
}

export async function cacheFromResponse<T>(key: string, data: T): Promise<T> {
  await setReferenceCache(key, data);
  return data;
}

export const REFERENCE_KEYS = {
  services: 'ref:services',
  employees: 'ref:employees',
  accounts: 'ref:accounts',
} as const;

export async function hasMinimumReferenceCache(): Promise<boolean> {
  const [services, employees] = await Promise.all([
    getReferenceCache(REFERENCE_KEYS.services),
    getReferenceCache(REFERENCE_KEYS.employees),
  ]);
  return (
    Array.isArray(services?.data) &&
    (services.data as unknown[]).length > 0 &&
    Array.isArray(employees?.data) &&
    (employees.data as unknown[]).length > 0
  );
}
