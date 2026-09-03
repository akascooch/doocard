import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  BACKUP_DELETE_ORDER,
  BACKUP_INSERT_ORDER,
  BACKUP_SKIP_RESTORE_INSERT,
  BACKUP_SKIP_RESTORE_DELETE,
  BACKUP_VERSION,
  BackupModelKey,
  BackupPayload,
  MASK_PLACEHOLDER,
  RestoreResult,
} from './backup.types';
import {
  assertRestoreEnvironmentAllowed,
  formatPreRestoreSnapshotFileName,
  getExpectedRowCounts,
  isReplicationRolePermissionError,
  orderRowsForInsert,
  RESTORE_REPLICATION_ROLE_ERROR,
  validateBackupPayloadForRestore,
} from './backup-restore.lib';

const BIGINT_FIELDS = new Set([
  'amount',
  'tipAmount',
  'barberPayoutGrossAmount',
  'settlementDeductionAmount',
  'barberPayoutNetAmount',
  'deductionPerAppointmentAmount',
  'balance',
  'grossAppointmentTotalRial',
  'grossEmployeeShareRial',
  'deductionPerAppointmentRial',
  'totalAppointmentDeductionRial',
  'priorWithdrawalsTotalRial',
  'netPayableRial',
  'appointmentAmountRial',
  'employeeShareRial',
  'appointmentDeductionRial',
  'amountRial',
]);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly defaultBackupDir: string;

  constructor(private readonly prisma: PrismaService) {
    this.defaultBackupDir = path.normalize(
      process.env.BACKUP_DEFAULT_PATH || path.join(process.cwd(), 'backups'),
    );
  }

  // ---------------------------------------------------------------------------
  // System settings
  // ---------------------------------------------------------------------------

  async getSystemSettings() {
    return this.prisma.systemSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });
  }

  async updateSystemSettings(data: {
    autoBackupEnabled?: boolean;
    backupIntervalDays?: number;
    backupPath?: string | null;
  }) {
    if (data.backupIntervalDays !== undefined) {
      if (data.backupIntervalDays < 1 || data.backupIntervalDays > 365) {
        throw new BadRequestException('فاصله پشتیبان‌گیری باید بین ۱ تا ۳۶۵ روز باشد');
      }
    }

    if (data.backupPath !== undefined && data.backupPath !== null && data.backupPath.trim()) {
      this.resolveBackupDirectory(data.backupPath);
    }

    return this.prisma.systemSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        autoBackupEnabled: data.autoBackupEnabled ?? false,
        backupIntervalDays: data.backupIntervalDays ?? 7,
        backupPath: data.backupPath ?? null,
      },
      update: {
        ...(data.autoBackupEnabled !== undefined && {
          autoBackupEnabled: data.autoBackupEnabled,
        }),
        ...(data.backupIntervalDays !== undefined && {
          backupIntervalDays: data.backupIntervalDays,
        }),
        ...(data.backupPath !== undefined && { backupPath: data.backupPath }),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Backup creation
  // ---------------------------------------------------------------------------

  async exportManualBackup(): Promise<{ buffer: Buffer; fileName: string }> {
    try {
      return await this.buildBackupBuffer();
    } catch (error) {
      this.logger.error('exportManualBackup failed', error?.stack || error);
      throw new InternalServerErrorException(
        `خطا در ایجاد پشتیبان: ${error?.message || 'نامشخص'}`,
      );
    }
  }

  async createBackup(): Promise<{ filePath: string; fileName: string }> {
    try {
      const settings = await this.getSystemSettings();
      const backupDir = this.resolveBackupDirectory(settings.backupPath);
      const { buffer, fileName } = await this.buildBackupBuffer();
      const filePath = path.join(backupDir, fileName);

      fs.writeFileSync(filePath, buffer);
      this.logger.log(`Backup written to ${filePath}`);

      await this.prisma.systemSettings.update({
        where: { id: 1 },
        data: { lastBackupDate: new Date() },
      });

      return { filePath, fileName };
    } catch (error) {
      this.logger.error('createBackup failed', error?.stack || error);
      throw new InternalServerErrorException(
        `خطا در ایجاد پشتیبان: ${error?.message || 'نامشخص'}`,
      );
    }
  }

  private async buildBackupBuffer(): Promise<{ buffer: Buffer; fileName: string }> {
    const payload = await this.exportAllData();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `doocard-backup-${stamp}.json`;
    const buffer = Buffer.from(JSON.stringify(payload, this.jsonReplacer, 2), 'utf8');
    return { buffer, fileName };
  }

  async getBackupInfo() {
    const settings = await this.getSystemSettings();
    const backupDir = this.resolveBackupDirectory(settings.backupPath);
    const files = this.listBackupFiles(backupDir);

    return {
      autoBackupEnabled: settings.autoBackupEnabled,
      backupIntervalDays: settings.backupIntervalDays,
      backupPath: settings.backupPath || backupDir,
      lastBackupDate: settings.lastBackupDate,
      backupCount: files.length,
      backups: files.slice(0, 20),
    };
  }

  // ---------------------------------------------------------------------------
  // Restore
  // ---------------------------------------------------------------------------

  async restoreFromUploadedJson(raw: string | Buffer): Promise<RestoreResult> {
    assertRestoreEnvironmentAllowed();

    if (!raw || (Buffer.isBuffer(raw) && raw.length === 0)) {
      throw new BadRequestException('فایل پشتیبان خالی است');
    }

    try {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8');
      if (!text.trim()) {
        throw new BadRequestException('فایل پشتیبان خالی است');
      }
      const parsed = JSON.parse(text, this.jsonReviver) as BackupPayload;
      return await this.restoreBackupPayload(parsed);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      if (error instanceof SyntaxError) {
        throw new BadRequestException('فایل پشتیبان JSON نامعتبر است');
      }
      this.logger.error('restoreFromUploadedJson failed', error?.stack || error);
      throw error;
    }
  }

  async restoreFromFile(filePath: string): Promise<RestoreResult> {
    assertRestoreEnvironmentAllowed();
    try {
      const normalized = path.normalize(filePath);
      if (!fs.existsSync(normalized)) {
        throw new BadRequestException('فایل پشتیبان یافت نشد');
      }
      const content = fs.readFileSync(normalized, 'utf8');
      return await this.restoreFromUploadedJson(content);
    } catch (error) {
      this.logger.error(`restoreFromFile failed: ${filePath}`, error?.stack || error);
      throw error;
    }
  }

  private async createPreRestoreSnapshot(): Promise<string> {
    const snapshotDir = path.join(this.defaultBackupDir, 'pre-restore');
    fs.mkdirSync(snapshotDir, { recursive: true });

    const { buffer } = await this.buildBackupBuffer();
    const fileName = formatPreRestoreSnapshotFileName();
    const filePath = path.join(snapshotDir, fileName);

    fs.writeFileSync(filePath, buffer);
    this.logger.log(`Pre-restore snapshot written (${buffer.length} bytes)`);
    return filePath;
  }

  private async restoreBackupPayload(backup: BackupPayload): Promise<RestoreResult> {
    validateBackupPayloadForRestore(backup);

    const systemSettingsBefore = await this.prisma.systemSettings.findUnique({
      where: { id: 1 },
    });

    let snapshotPath: string;
    try {
      snapshotPath = await this.createPreRestoreSnapshot();
    } catch (error) {
      this.logger.error('Pre-restore snapshot failed', error?.stack || error);
      throw new InternalServerErrorException(
        'ایجاد نسخه پشتیبان قبل از بازیابی ناموفق بود — بازیابی متوقف شد',
      );
    }

    const stats: Record<string, number> = {};
    const restoredModels: BackupModelKey[] = [];
    const skippedModels: BackupModelKey[] = [
      ...BACKUP_SKIP_RESTORE_INSERT,
    ];
    const warnings: string[] = [];

    try {
      await this.prisma.$transaction(
        async (tx) => {
          let replicaEnabled = false;
          try {
            await tx.$executeRaw`SET session_replication_role = replica`;
            replicaEnabled = true;
          } catch (error) {
            if (isReplicationRolePermissionError(error)) {
              throw new InternalServerErrorException(RESTORE_REPLICATION_ROLE_ERROR);
            }
            throw error;
          }

          try {
            for (const modelKey of BACKUP_DELETE_ORDER) {
              if (BACKUP_SKIP_RESTORE_DELETE.includes(modelKey)) {
                this.logger.log(`Skipping delete for ${modelKey} (session stability)`);
                continue;
              }
              const delegate = (tx as any)[modelKey] as {
                deleteMany: () => Promise<{ count: number }>;
              };
              if (delegate?.deleteMany) {
                const result = await delegate.deleteMany();
                this.logger.log(`Deleted ${modelKey}: ${result.count} rows`);
              }
            }

            for (const modelKey of BACKUP_INSERT_ORDER) {
              if (BACKUP_SKIP_RESTORE_INSERT.includes(modelKey)) {
                this.logger.log(`Skipping insert for ${modelKey} (session/ephemeral)`);
                stats[modelKey] = 0;
                continue;
              }

              const rows = backup.data[modelKey];
              if (!Array.isArray(rows) || rows.length === 0) {
                stats[modelKey] = 0;
                continue;
              }

              const prepared = orderRowsForInsert(
                modelKey,
                rows.map((row) => this.prepareRowForInsert(row, modelKey)),
              );

              const delegate = (tx as any)[modelKey] as {
                createMany?: (args: {
                  data: Record<string, unknown>[];
                  skipDuplicates?: boolean;
                }) => Promise<{ count: number }>;
              };

              if (!delegate?.createMany) {
                this.logger.warn(`No createMany for model ${modelKey}`);
                stats[modelKey] = 0;
                continue;
              }

              const batchSize = modelKey === 'calendarDate' ? 500 : 200;
              let inserted = 0;
              for (let i = 0; i < prepared.length; i += batchSize) {
                const batch = prepared.slice(i, i + batchSize);
                const result = await delegate.createMany({
                  data: batch,
                  skipDuplicates: false,
                });
                inserted += result.count;
              }
              stats[modelKey] = inserted;
              restoredModels.push(modelKey);
              this.logger.log(`Inserted ${modelKey}: ${inserted}/${rows.length} rows`);
            }
          } finally {
            if (replicaEnabled) {
              await tx.$executeRaw`SET session_replication_role = DEFAULT`;
            }
          }
        },
        { maxWait: 120000, timeout: 600000 },
      );
    } catch (error) {
      this.logger.error('restoreBackupPayload transaction failed', error?.stack || error);
      if (error instanceof InternalServerErrorException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `خطا در بازیابی پشتیبان: ${error?.message || 'نامشخص'}`,
      );
    }

    const rowCounts: RestoreResult['rowCounts'] = {};
    const expectedCounts = getExpectedRowCounts(backup);

    for (const modelKey of BACKUP_INSERT_ORDER) {
      if (BACKUP_SKIP_RESTORE_INSERT.includes(modelKey)) {
        continue;
      }
      const delegate = (this.prisma as any)[modelKey] as {
        count?: () => Promise<number>;
      };
      const actual = delegate?.count ? await delegate.count() : 0;
      const expected = expectedCounts[modelKey] ?? 0;
      rowCounts[modelKey] = { expected, actual };
      if (expected > 0 && actual !== expected) {
        warnings.push(
          `Row count mismatch for ${modelKey}: expected ${expected}, actual ${actual}`,
        );
      }
    }

    const systemSettingsAfter = await this.prisma.systemSettings.findUnique({
      where: { id: 1 },
    });
    if (JSON.stringify(systemSettingsBefore) !== JSON.stringify(systemSettingsAfter)) {
      warnings.push('systemSettings changed during restore (unexpected)');
    } else {
      this.logger.log('systemSettings unchanged (verified)');
    }

    if (warnings.length > 0) {
      this.logger.warn(`Restore completed with warnings: ${warnings.join('; ')}`);
    } else {
      this.logger.log('Restore completed successfully — post-flight verification passed');
    }

    return {
      success: true,
      snapshotPath,
      restoredModels,
      skippedModels,
      rowCounts,
      warnings,
      stats,
    };
  }

  // ---------------------------------------------------------------------------
  // Scheduled backup
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleScheduledBackup(): Promise<void> {
    try {
      const settings = await this.getSystemSettings();
      if (!settings.autoBackupEnabled) {
        return;
      }

      const intervalMs = settings.backupIntervalDays * 24 * 60 * 60 * 1000;
      const lastRun = settings.lastBackupDate?.getTime() ?? 0;
      const now = Date.now();

      if (now - lastRun < intervalMs) {
        this.logger.debug(
          `Skipping scheduled backup — next due in ${Math.ceil((intervalMs - (now - lastRun)) / 86400000)} day(s)`,
        );
        return;
      }

      this.logger.log('Running scheduled auto-backup...');
      const result = await this.createBackup();
      this.logger.log(`Scheduled backup completed: ${result.fileName}`);
    } catch (error) {
      this.logger.error('Scheduled backup failed', error?.stack || error);
    }
  }

  // ---------------------------------------------------------------------------
  // Export helpers
  // ---------------------------------------------------------------------------

  private async exportAllData(): Promise<BackupPayload> {
    const data: Record<string, unknown[]> = {};
    const stats: Record<string, number> = {};

    for (const modelKey of BACKUP_INSERT_ORDER) {
      try {
        const delegate = (this.prisma as any)[modelKey] as {
          findMany: () => Promise<unknown[]>;
        };
        if (!delegate?.findMany) {
          this.logger.warn(`Skipping unknown model: ${modelKey}`);
          continue;
        }
        const rows = await delegate.findMany();
        const masked = rows.map((row) => this.maskSensitiveRow(row, modelKey));
        data[modelKey] = masked;
        stats[modelKey] = masked.length;
      } catch (error) {
        this.logger.error(`Failed to export ${modelKey}`, error?.stack || error);
        throw error;
      }
    }

    return {
      metadata: {
        version: BACKUP_VERSION,
        timestamp: new Date().toISOString(),
        database: 'doocard',
        modelCount: BACKUP_INSERT_ORDER.length,
        stats,
        maskedFields: [
          'smsSettings.apiKey',
          'financialReportsAccess.passwordHash',
          'refreshToken.token',
          'pushSubscription.p256dh',
          'pushSubscription.auth',
        ],
      },
      data,
    };
  }

  private maskSensitiveRow(row: unknown, modelKey: BackupModelKey): Record<string, unknown> {
    const record = { ...(row as Record<string, unknown>) };

    if (modelKey === 'user' && record.password) {
      // bcrypt hashes are kept for post-restore login
    }
    if (modelKey === 'smsSettings' && record.apiKey) {
      record.apiKey = MASK_PLACEHOLDER;
    }
    if (modelKey === 'financialReportsAccess' && record.passwordHash) {
      record.passwordHash = MASK_PLACEHOLDER;
    }
    if (modelKey === 'refreshToken' && record.token) {
      record.token = MASK_PLACEHOLDER;
    }
    if (modelKey === 'pushSubscription') {
      if (record.p256dh) record.p256dh = MASK_PLACEHOLDER;
      if (record.auth) record.auth = MASK_PLACEHOLDER;
    }

    return record;
  }

  private prepareRowForInsert(row: unknown, modelKey: BackupModelKey): Record<string, unknown> {
    const record = { ...(row as Record<string, unknown>) };

    for (const key of Object.keys(record)) {
      if (record[key] === MASK_PLACEHOLDER) {
        delete record[key];
      }
      if (BIGINT_FIELDS.has(key) && typeof record[key] === 'string' && /^\d+$/.test(record[key] as string)) {
        record[key] = BigInt(record[key] as string);
      }
    }

    if (modelKey === 'user' && !record.password) {
      throw new BadRequestException('رکورد کاربر بدون رمز عبور در پشتیبان یافت شد');
    }

    return record;
  }

  // ---------------------------------------------------------------------------
  // Path utilities
  // ---------------------------------------------------------------------------

  resolveBackupDirectory(customPath?: string | null): string {
    const raw = (customPath?.trim() || this.defaultBackupDir).replace(/^["']|["']$/g, '');
    const normalized = path.normalize(raw);

    if (normalized.includes('..')) {
      throw new BadRequestException('مسیر پشتیبان‌گیری نامعتبر است');
    }

    const blockedWin = /^[a-zA-Z]:\\(windows|program files|program files \(x86\)|system32)(\\|$)/i;
    const blockedUnix = /^\/(etc|usr|bin|sbin|var|sys|proc)(\/|$)/i;
    if (blockedWin.test(normalized) || blockedUnix.test(normalized.replace(/\\/g, '/'))) {
      throw new BadRequestException('مسیر پشتیبان‌گیری مجاز نیست');
    }

    try {
      fs.mkdirSync(normalized, { recursive: true });
      fs.accessSync(normalized, fs.constants.W_OK);
    } catch (error) {
      this.logger.error(`Cannot use backup directory: ${normalized}`, error?.stack || error);
      throw new BadRequestException(
        `امکان نوشتن در مسیر پشتیبان وجود ندارد: ${normalized}`,
      );
    }

    return normalized;
  }

  private listBackupFiles(backupDir: string) {
    try {
      return fs
        .readdirSync(backupDir)
        .filter((f) => f.endsWith('.json'))
        .map((name) => {
          const fullPath = path.join(backupDir, name);
          const stat = fs.statSync(fullPath);
          return {
            name,
            size: stat.size,
            createdAt: stat.birthtime,
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      this.logger.warn(`Could not list backups in ${backupDir}`, error?.message);
      return [];
    }
  }

  private jsonReplacer(_key: string, value: unknown): unknown {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }

  private jsonReviver(_key: string, value: unknown): unknown {
    return value;
  }
}
