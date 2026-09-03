import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

const TTL_MS = 5 * 60 * 1000;

interface CachedBackupDownload {
  buffer: Buffer;
  fileName: string;
  createdAt: number;
}

@Injectable()
export class BackupDownloadCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupDownloadCacheService.name);
  private readonly store = new Map<string, CachedBackupDownload>();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  onModuleInit() {
    this.cleanupTimer = setInterval(() => this.purgeExpired(), 60_000);
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.store.clear();
  }

  /** Store buffer in memory; returns one-time download token. */
  stage(buffer: Buffer, fileName: string): string {
    this.purgeExpired();
    const downloadId = randomUUID();
    this.store.set(downloadId, {
      buffer,
      fileName,
      createdAt: Date.now(),
    });
    this.logger.debug(
      `Staged manual backup download id=${downloadId} bytes=${buffer.length}`,
    );
    return downloadId;
  }

  /** Retrieve and remove buffer (single-use token). */
  take(downloadId: string): { buffer: Buffer; fileName: string } {
    this.purgeExpired();
    const entry = this.store.get(downloadId);
    if (!entry) {
      throw new NotFoundException('لینک دانلود پشتیبان منقضی شده یا نامعتبر است');
    }
    if (Date.now() - entry.createdAt > TTL_MS) {
      this.store.delete(downloadId);
      throw new NotFoundException('لینک دانلود پشتیبان منقضی شده است');
    }
    this.store.delete(downloadId);
    return { buffer: entry.buffer, fileName: entry.fileName };
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.store.entries()) {
      if (now - entry.createdAt > TTL_MS) {
        this.store.delete(id);
        this.logger.debug(`Purged expired backup download token ${id}`);
      }
    }
  }
}
