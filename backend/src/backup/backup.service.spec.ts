import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
    process.env = { ...originalEnv, NODE_ENV: 'development' };
    delete process.env.BACKUP_RESTORE_ALLOW_PRODUCTION;

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

  it('rolls back when transaction insert fails', async () => {
    prisma.$transaction.mockRejectedValue(new Error('insert failed'));

    await expect(
      service.restoreFromUploadedJson(JSON.stringify(minimalBackupPayload())),
    ).rejects.toThrow(/بازیابی/);
  });
});
