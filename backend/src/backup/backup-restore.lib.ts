import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  BACKUP_ALLOWED_DATA_KEYS,
  BACKUP_FORBIDDEN_DATA_KEYS,
  BACKUP_INSERT_ORDER,
  BACKUP_SKIP_RESTORE_INSERT,
  BackupModelKey,
  BackupPayload,
} from './backup.types';

export const RESTORE_REPLICATION_ROLE_ERROR =
  'نقش دیتابیس اجازه تنظیم session_replication_role ندارد. برای آفلاین: GRANT SET ON PARAMETER session_replication_role را به نقش اپ بدهید، یا BACKUP_RESTORE_ALLOW_WITHOUT_REPLICATION=true را فقط به‌صورت محلی فعال کنید.';

/** Allow ordered FK restore without disabling triggers via session_replication_role. */
export function canRestoreWithoutReplicationRole(): boolean {
  if (process.env.BACKUP_RESTORE_ALLOW_WITHOUT_REPLICATION === 'true') {
    return true;
  }
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  return process.env.BACKUP_RESTORE_ALLOW_PRODUCTION === 'true';
}

/** Prisma P2021 = table missing, P2022 = column missing (schema drift vs client). */
export function isSchemaDriftExportError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'P2021' || code === 'P2022') {
    return true;
  }
  const message = String((error as { message?: string } | null)?.message ?? error ?? '');
  return (
    /does not exist in the current database/i.test(message) ||
    /The table `.*` does not exist/i.test(message) ||
    /The column `.*` does not exist/i.test(message)
  );
}

/**
 * When true, a failed pre-restore JSON snapshot must not block restore.
 * Intended for local/offline (ALLOW_PRODUCTION flag) or explicit SKIP.
 * Strict production without flags still requires a successful pre-backup.
 */
export function canSkipFailedPreRestoreSnapshot(): boolean {
  if (process.env.BACKUP_RESTORE_SKIP_PRE_BACKUP === 'true') {
    return true;
  }
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  return process.env.BACKUP_RESTORE_ALLOW_PRODUCTION === 'true';
}

/** Block restore in production unless explicitly opted in. */
export function assertRestoreEnvironmentAllowed(): void {
  if (process.env.NODE_ENV === 'production' && process.env.BACKUP_RESTORE_ALLOW_PRODUCTION !== 'true') {
    throw new ForbiddenException(
      'بازیابی دیتابیس در حالت production غیرفعال است. فقط برای نگهداری کنترل‌شده BACKUP_RESTORE_ALLOW_PRODUCTION=true را تنظیم کنید.',
    );
  }
}

/** Reject PostgreSQL custom dumps / SQL dumps uploaded to the JSON restore endpoint. */
export function assertUploadedBackupLooksLikeJson(raw: string | Buffer): void {
  if (Buffer.isBuffer(raw)) {
    // PostgreSQL custom archive magic: "PGDMP"
    if (
      raw.length >= 5 &&
      raw[0] === 0x50 &&
      raw[1] === 0x47 &&
      raw[2] === 0x44 &&
      raw[3] === 0x4d &&
      raw[4] === 0x50
    ) {
      throw new BadRequestException(
        'این فایل پشتیبان باینری PostgreSQL (pg_dump -Fc) است. بازیابی JSON از تنظیمات فقط فایل‌های doocard-backup-*.json را می‌پذیرد. برای انتقال کامل دیتابیس به آفلاین از scripts/refresh-offline-snapshot استفاده کنید.',
      );
    }
  }

  const text = (typeof raw === 'string' ? raw : raw.toString('utf8')).trimStart();
  if (!text) {
    throw new BadRequestException('فایل پشتیبان خالی است');
  }
  if (text.startsWith('--') || text.toUpperCase().startsWith('PGDMP') || /^CREATE\s+DATABASE/i.test(text)) {
    throw new BadRequestException(
      'فایل شبیه SQL/dump پایگاه‌داده است، نه پشتیبان JSON. برای همگام‌سازی آفلاین از اسکریپت refresh-offline-snapshot استفاده کنید.',
    );
  }
  if (!(text.startsWith('{') || text.startsWith('['))) {
    throw new BadRequestException(
      'فرمت فایل پشتیبانی نمی‌شود. فقط پشتیبان JSON سیستم (doocard-backup-*.json) قابل بازیابی از این صفحه است.',
    );
  }
}

/** Pre-flight validation — no DB mutations. */
export function validateBackupPayloadForRestore(backup: unknown): asserts backup is BackupPayload {
  if (!backup || typeof backup !== 'object') {
    throw new BadRequestException('ساختار فایل پشتیبان نامعتبر است');
  }

  const payload = backup as BackupPayload;

  if (!payload.metadata || typeof payload.metadata !== 'object') {
    throw new BadRequestException('فایل پشتیبان فاقد metadata است');
  }

  if (!payload.metadata.version || typeof payload.metadata.version !== 'string') {
    throw new BadRequestException('نسخه پشتیبان (metadata.version) نامعتبر است');
  }

  if (!payload.metadata.timestamp || typeof payload.metadata.timestamp !== 'string') {
    throw new BadRequestException('زمان پشتیبان (metadata.timestamp) نامعتبر است');
  }

  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
    throw new BadRequestException('بخش data فایل پشتیبان نامعتبر است');
  }

  for (const forbidden of BACKUP_FORBIDDEN_DATA_KEYS) {
    if (forbidden in payload.data) {
      throw new BadRequestException(
        `فایل پشتیبان حاوی مدل غیرمجاز "${forbidden}" است — systemSettings قابل بازیابی نیست`,
      );
    }
  }

  for (const key of Object.keys(payload.data)) {
    if (!BACKUP_ALLOWED_DATA_KEYS.has(key)) {
      throw new BadRequestException(`کلید ناشناخته در data: "${key}"`);
    }
    if (!Array.isArray(payload.data[key])) {
      throw new BadRequestException(`مقدار data.${key} باید آرایه باشد`);
    }
  }

  const users = payload.data.user;
  if (!Array.isArray(users) || users.length === 0) {
    throw new BadRequestException('فایل پشتیبان حداقل یک کاربر (data.user) باید داشته باشد');
  }
}

/** Parent-first ordering for transactionCategory self-FK (parentId). */
export function sortTransactionCategoryParentFirst(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  if (rows.length <= 1) {
    return rows;
  }

  const byId = new Map<number, Record<string, unknown>>();
  for (const row of rows) {
    const id = row.id as number;
    if (typeof id === 'number') {
      byId.set(id, row);
    }
  }

  const sorted: Record<string, unknown>[] = [];
  const inserted = new Set<number>();
  const visiting = new Set<number>();

  const visit = (row: Record<string, unknown>) => {
    const id = row.id as number;
    if (typeof id !== 'number' || inserted.has(id)) {
      return;
    }
    if (visiting.has(id)) {
      throw new BadRequestException(
        'چرخه parentId در transactionCategory — پشتیبان نامعتبر است',
      );
    }
    visiting.add(id);

    const parentId = row.parentId as number | null | undefined;
    if (parentId != null && byId.has(parentId) && !inserted.has(parentId)) {
      visit(byId.get(parentId)!);
    }

    visiting.delete(id);
    inserted.add(id);
    sorted.push(row);
  };

  for (const row of rows) {
    visit(row);
  }

  return sorted;
}

/** Multi-pass insert order when parent rows may appear after children in backup array. */
export function orderRowsForInsert(
  modelKey: BackupModelKey,
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  if (modelKey === 'transactionCategory') {
    return sortTransactionCategoryParentFirst(rows);
  }
  return rows;
}

export function formatPreRestoreSnapshotFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `pre-restore-${stamp}.json`;
}

export function getExpectedRowCounts(backup: BackupPayload): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const modelKey of BACKUP_INSERT_ORDER) {
    if (BACKUP_SKIP_RESTORE_INSERT.includes(modelKey)) {
      counts[modelKey] = 0;
      continue;
    }
    counts[modelKey] = Array.isArray(backup.data[modelKey]) ? backup.data[modelKey].length : 0;
  }
  return counts;
}

export function isReplicationRolePermissionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const msg = String((error as Error).message || '').toLowerCase();
  return (
    msg.includes('session_replication_role') ||
    msg.includes('permission denied') ||
    msg.includes('must be superuser') ||
    msg.includes('insufficient privilege')
  );
}
