import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BACKUP_VERSION } from './backup.types';
import {
  assertRestoreEnvironmentAllowed,
  formatPreRestoreSnapshotFileName,
  orderRowsForInsert,
  sortTransactionCategoryParentFirst,
  validateBackupPayloadForRestore,
} from './backup-restore.lib';

function minimalBackup(overrides: Record<string, unknown> = {}) {
  return {
    metadata: {
      version: BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      database: 'doocard',
      modelCount: 34,
      stats: { user: 1 },
      maskedFields: [],
    },
    data: {
      user: [{ id: 1, phone: '09120000000', password: 'hash', name: 'Admin', role: 'ADMIN' }],
      ...overrides,
    },
  };
}

describe('backup-restore.lib', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validateBackupPayloadForRestore', () => {
    it('rejects missing metadata', () => {
      expect(() => validateBackupPayloadForRestore({ data: { user: [{}] } })).toThrow(
        BadRequestException,
      );
    });

    it('rejects empty user array', () => {
      const backup = minimalBackup({ user: [] });
      expect(() => validateBackupPayloadForRestore(backup)).toThrow(BadRequestException);
    });

    it('rejects systemSettings key', () => {
      const backup = minimalBackup({ systemSettings: [{ id: 1 }] });
      expect(() => validateBackupPayloadForRestore(backup)).toThrow(/systemSettings/);
    });

    it('rejects unknown model keys', () => {
      const backup = minimalBackup({ unknownModel: [] });
      expect(() => validateBackupPayloadForRestore(backup)).toThrow(/ناشناخته/);
    });

    it('rejects non-array model data', () => {
      const backup = minimalBackup({ service: { id: 1 } });
      expect(() => validateBackupPayloadForRestore(backup)).toThrow(/service/);
    });

    it('accepts valid minimal backup', () => {
      expect(() => validateBackupPayloadForRestore(minimalBackup())).not.toThrow();
    });
  });

  describe('sortTransactionCategoryParentFirst', () => {
    it('orders parent before child', () => {
      const rows = [
        { id: 2, name: 'Child', parentId: 1, type: 'EXPENSE' },
        { id: 1, name: 'Parent', parentId: null, type: 'EXPENSE' },
      ];
      const sorted = sortTransactionCategoryParentFirst(rows);
      expect(sorted.map((r) => r.id)).toEqual([1, 2]);
    });

    it('detects parentId cycles', () => {
      const rows = [
        { id: 1, name: 'A', parentId: 2, type: 'EXPENSE' },
        { id: 2, name: 'B', parentId: 1, type: 'EXPENSE' },
      ];
      expect(() => sortTransactionCategoryParentFirst(rows)).toThrow(BadRequestException);
    });
  });

  describe('orderRowsForInsert', () => {
    it('sorts transactionCategory only', () => {
      const rows = [
        { id: 2, name: 'C', parentId: 1, type: 'INCOME' },
        { id: 1, name: 'P', parentId: null, type: 'INCOME' },
      ];
      const ordered = orderRowsForInsert('transactionCategory', rows);
      expect(ordered[0].id).toBe(1);
    });
  });

  describe('assertRestoreEnvironmentAllowed', () => {
    it('blocks production without explicit flag', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.BACKUP_RESTORE_ALLOW_PRODUCTION;
      expect(() => assertRestoreEnvironmentAllowed()).toThrow(ForbiddenException);
    });

    it('allows production when flag set', () => {
      process.env.NODE_ENV = 'production';
      process.env.BACKUP_RESTORE_ALLOW_PRODUCTION = 'true';
      expect(() => assertRestoreEnvironmentAllowed()).not.toThrow();
    });

    it('allows development', () => {
      process.env.NODE_ENV = 'development';
      expect(() => assertRestoreEnvironmentAllowed()).not.toThrow();
    });
  });

  describe('formatPreRestoreSnapshotFileName', () => {
    it('uses deterministic readable pattern', () => {
      const name = formatPreRestoreSnapshotFileName(new Date('2026-06-25T14:30:45'));
      expect(name).toBe('pre-restore-20260625-143045.json');
    });
  });
});
