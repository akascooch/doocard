import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as fs from 'fs';
import { BackupService } from './backup.service';
import { BACKUP_VERSION } from './backup.types';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('fs');

function minimalBackupPayload() {
  return {
    metadata: {
      version: BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      database: 'doocard',
      modelCount: 1,
      stats: { user: 1 },
      maskedFields: [],
    },
    data: {
      user: [
        {
          id: 1,
          phone: '09121111111',
          password: '$2b$10$abcdefghijklmnopqrstuv',
          name: 'Admin',
          role: 'ADMIN',
        },
      ],
    },
  };
}

describe('BackupService restore', () => {
  const originalEnv = process.env;
  let service: BackupService;
  let prisma: {
    systemSettings: { findUnique: jest.Mock };
    $transaction: jest.Mock;
    user: { deleteMany: jest.Mock; createMany: jest.Mock; count: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: 'development' };
    delete process.env.BACKUP_RESTORE_ALLOW_PRODUCTION;
    delete process.env.BACKUP_RESTORE_SKIP_PRE_BACKUP;
    delete process.env.BACKUP_RESTORE_ALLOW_WITHOUT_REPLICATION;

    prisma = {
      systemSettings: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, autoBackupEnabled: false }),
      },
      $transaction: jest.fn(),
      user: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(1),
      },
    };

    (fs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
    (fs.writeFileSync as jest.Mock).mockImplementation(() => undefined);

    service = new BackupService(prisma as unknown as PrismaService);

    jest.spyOn(service as any, 'buildBackupBuffer').mockResolvedValue({
      buffer: Buffer.from('{}'),
      fileName: 'snap.json',
    });
    jest.spyOn(service as any, 'exportAllData').mockResolvedValue(minimalBackupPayload());
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects concurrent restore with HTTP 409 Conflict (F-RST-04)', async () => {
    let releaseTx!: () => void;
    const txGate = new Promise<void>((resolve) => {
      releaseTx = resolve;
    });

    prisma.$transaction.mockImplementation(async (fn: (client: any) => Promise<void>) => {
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(undefined),
        user: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      await fn(tx);
      await txGate;
    });

    const first = service.restoreFromUploadedJson(JSON.stringify(minimalBackupPayload()));
    // Allow first restore to acquire the mutex and enter the transaction
    await new Promise((r) => setImmediate(r));

    await expect(
      service.restoreFromUploadedJson(JSON.stringify(minimalBackupPayload())),
    ).rejects.toBeInstanceOf(ConflictException);

    releaseTx();
    await first;
  });

  it('rejects malformed JSON before any transaction', async () => {
    await expect(service.restoreFromUploadedJson('not-json')).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects unknown model key before snapshot or transaction', async () => {
    const payload = {
      ...minimalBackupPayload(),
      data: { ...minimalBackupPayload().data, evilModel: [] },
    };
    await expect(
      service.restoreFromUploadedJson(JSON.stringify(payload)),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('blocks restore in production without flag', async () => {
    process.env.NODE_ENV = 'production';
    await expect(
      service.restoreFromUploadedJson(JSON.stringify(minimalBackupPayload())),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('skips refreshToken and pushSubscription inserts', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      refreshToken: { deleteMany: jest.fn() },
      pushSubscription: { deleteMany: jest.fn() },
      user: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    prisma.$transaction.mockImplementation(async (fn: (client: typeof tx) => Promise<void>) => {
      await fn(tx);
    });

    const payload = {
      ...minimalBackupPayload(),
      data: {
        ...minimalBackupPayload().data,
        refreshToken: [{ id: 1, token: '[REDACTED]', userId: 1 }],
        pushSubscription: [{ id: 1, userId: 1, endpoint: 'x', p256dh: 'a', auth: 'b' }],
      },
    };

    const result = await service.restoreFromUploadedJson(JSON.stringify(payload));

    expect(tx.user.createMany).toHaveBeenCalled();
    expect(result.skippedModels).toEqual(
      expect.arrayContaining(['refreshToken', 'pushSubscription']),
    );
    expect(result.snapshotPath).toContain('pre-restore');
  });

  it('does not delete models omitted from a legacy dump payload', async () => {
    const productDeleteMany = jest.fn().mockResolvedValue({ count: 9 });
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      product: { deleteMany: productDeleteMany },
      user: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    prisma.$transaction.mockImplementation(async (fn: (client: typeof tx) => Promise<void>) => {
      await fn(tx);
    });

    await service.restoreFromUploadedJson(JSON.stringify(minimalBackupPayload()));

    expect(productDeleteMany).not.toHaveBeenCalled();
    expect(tx.user.deleteMany).toHaveBeenCalled();
  });

  it('rolls back when transaction insert fails', async () => {
    prisma.$transaction.mockRejectedValue(new Error('insert failed'));

    await expect(
      service.restoreFromUploadedJson(JSON.stringify(minimalBackupPayload())),
    ).rejects.toThrow(/بازیابی/);
  });

  it('skips pre-restore entirely when BACKUP_RESTORE_SKIP_PRE_BACKUP=true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.BACKUP_RESTORE_ALLOW_PRODUCTION = 'true';
    process.env.BACKUP_RESTORE_SKIP_PRE_BACKUP = 'true';
    const buildSpy = jest.spyOn(service as any, 'buildBackupBuffer');

    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      user: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction.mockImplementation(async (fn: (client: typeof tx) => Promise<void>) => {
      await fn(tx);
    });

    const result = await service.restoreFromUploadedJson(JSON.stringify(minimalBackupPayload()));
    expect(result.snapshotPath).toBe('skipped-pre-restore-by-flag');
    expect(buildSpy).not.toHaveBeenCalled();
    expect(tx.user.createMany).toHaveBeenCalled();
  });

  it('continues restore when pre-restore snapshot fails under allow-production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.BACKUP_RESTORE_ALLOW_PRODUCTION = 'true';
    delete process.env.BACKUP_RESTORE_SKIP_PRE_BACKUP;
    (service as any).buildBackupBuffer.mockRejectedValue(new Error('schema drift'));

    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      user: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction.mockImplementation(async (fn: (client: typeof tx) => Promise<void>) => {
      await fn(tx);
    });

    const result = await service.restoreFromUploadedJson(JSON.stringify(minimalBackupPayload()));
    expect(result.snapshotPath).toBe('skipped-pre-restore');
    expect(result.warnings?.length ?? 0).toBeGreaterThan(0);
    expect(tx.user.createMany).toHaveBeenCalled();
  });

  it('still blocks restoreBackupPayload when pre-restore fails in strict production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.BACKUP_RESTORE_ALLOW_PRODUCTION;
    delete process.env.BACKUP_RESTORE_SKIP_PRE_BACKUP;
    (service as any).buildBackupBuffer.mockRejectedValue(new Error('disk full'));

    // Public restoreFromUploadedJson is gated earlier by assertRestoreEnvironmentAllowed;
    // this covers the hard pre-restore failure path inside restoreBackupPayload.
    await expect(
      (service as any).restoreBackupPayload(minimalBackupPayload()),
    ).rejects.toThrow(/ایجاد نسخه پشتیبان قبل از بازیابی/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('keeps jalaliDate as string while coercing gregorianDate DateTime strings', () => {
    const prepared = (service as any).prepareRowForInsert(
      {
        id: 1,
        gregorianDate: '2024-08-16T00:00:00.000Z',
        jalaliDate: '1403-05-26',
        createdAt: '2026-06-02T13:02:59.364Z',
      },
      'calendarDate',
    );
    expect(typeof prepared.jalaliDate).toBe('string');
    expect(prepared.jalaliDate).toBe('1403-05-26');
    expect(prepared.gregorianDate).toBeInstanceOf(Date);
    expect(prepared.createdAt).toBeInstanceOf(Date);
  });

  it('continues restore without replication role when offline allow flags are set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.BACKUP_RESTORE_ALLOW_PRODUCTION = 'true';
    process.env.BACKUP_RESTORE_ALLOW_WITHOUT_REPLICATION = 'true';

    const tx = {
      $executeRaw: jest
        .fn()
        .mockRejectedValueOnce(new Error('permission denied to set parameter "session_replication_role"')),
      user: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction.mockImplementation(async (fn: (client: typeof tx) => Promise<void>) => {
      await fn(tx);
    });

    const result = await service.restoreFromUploadedJson(JSON.stringify(minimalBackupPayload()));
    expect(tx.user.createMany).toHaveBeenCalled();
    expect(result.warnings.join(' ')).toMatch(/session_replication_role/i);
  });
});
