import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { BackupService } from './backup.service';
import { BackupDownloadCacheService } from './backup-download-cache.service';

@Module({
  imports: [ScheduleModule, PrismaModule],
  providers: [BackupService, BackupDownloadCacheService],
  exports: [BackupService, BackupDownloadCacheService],
})
export class BackupModule {}
