import { Injectable } from '@nestjs/common';
import { BackupService } from '../backup/backup.service';
import { BackupDownloadCacheService } from '../backup/backup-download-cache.service';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly backupService: BackupService,
    private readonly backupDownloadCache: BackupDownloadCacheService,
  ) {}

  async getLogo() {
    return { message: 'Logo functionality not implemented yet' };
  }

  async getLogoInfo() {
    return { message: 'Logo info functionality not implemented yet' };
  }

  async uploadLogo(_file: Express.Multer.File) {
    return { message: 'Upload logo functionality not implemented yet' };
  }

  async deleteLogo() {
    return { message: 'Delete logo functionality not implemented yet' };
  }

  async resetDatabase() {
    return { message: 'Reset database functionality not implemented yet' };
  }

  async getConfig() {
    return this.backupService.getSystemSettings();
  }

  async updateConfig(dto: UpdateSystemSettingsDto) {
    return this.backupService.updateSystemSettings(dto);
  }

  /** Generate in-memory backup and return a one-time download token. */
  async stageManualBackupDownload(): Promise<{
    downloadId: string;
    fileName: string;
  }> {
    const { buffer, fileName } = await this.backupService.exportManualBackup();
    const downloadId = this.backupDownloadCache.stage(buffer, fileName);
    return { downloadId, fileName };
  }

  /** Consume one-time download token and return buffer (removed from cache). */
  takeManualBackupDownload(downloadId: string): { buffer: Buffer; fileName: string } {
    return this.backupDownloadCache.take(downloadId);
  }

  async restoreBackupFromUpload(raw: string | Buffer) {
    return this.backupService.restoreFromUploadedJson(raw);
  }

  async getBackupInfo() {
    return this.backupService.getBackupInfo();
  }
}
