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
  'Restore requires a PostgreSQL role with permission to set session_replication_role, or run restore using a privileged local DB user.';

/** Block restore in production unless explicitly opted in. */
export function assertRestoreEnvironmentAllowed(): void {
  if (process.env.NODE_ENV === 'production' && process.env.BACKUP_RESTORE_ALLOW_PRODUCTION !== 'true') {
    throw new ForbiddenException(
      'Database restore is disabled in production. Set BACKUP_RESTORE_ALLOW_PRODUCTION=true only for controlled maintenance.',
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
