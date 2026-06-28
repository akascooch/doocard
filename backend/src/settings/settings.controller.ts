import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  Req,
  Res,
  Param,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { SkipResponseTime } from '../common/decorators/skip-response-time.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { SettingsService } from './settings.service';
import { FinancialReportsAccessService } from './financial-reports-access.service';
import { SetFinancialReportsPasswordDto } from './dto/set-financial-reports-password.dto';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';
import { FileInterceptor } from '@nestjs/platform-express';

const MAX_BACKUP_BYTES = 300 * 1024 * 1024;
const isDev = process.env.NODE_ENV !== 'production';

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly financialReportsAccessService: FinancialReportsAccessService,
  ) {}

  @Get('logo')
  async getLogo() {
    return this.settingsService.getLogo();
  }

  @Get('logo-info')
  async getLogoInfo() {
    return this.settingsService.getLogoInfo();
  }

  @Post('upload-logo')
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('logo'))
  async uploadLogo(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|gif|svg)' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.settingsService.uploadLogo(file);
  }

  @Delete('logo')
  @Roles('ADMIN')
  async deleteLogo() {
    return this.settingsService.deleteLogo();
  }

  @Get('config')
  @Roles('ADMIN')
  async getConfig() {
    return this.settingsService.getConfig();
  }

  @Patch('config')
  @Roles('ADMIN')
  async updateConfig(@Body() dto: UpdateSystemSettingsDto) {
    return this.settingsService.updateConfig(dto);
  }

  /**
   * Phase 1 — authenticated: build in-memory backup, return one-time downloadId.
   */
  @Post('backup/run')
  @Roles('ADMIN')
  @SkipResponseTime()
  async runBackup(@Req() req: Request) {
    if (isDev) {
      const user = (req as any).user;
      this.logger.debug(
        `[backup/run] stage download token userId=${user?.id ?? '-'} role=${user?.role ?? '-'}`,
      );
    }
    const result = await this.settingsService.stageManualBackupDownload();
    if (isDev) {
      this.logger.debug(`[backup/run] staged downloadId=${result.downloadId}`);
    }
    return result;
  }

  /**
   * Phase 2 — public one-time GET: browser navigation download (bypasses SW/axios blobs).
   */
  @Public()
  @Get('backup/download-direct/:id')
  @SkipResponseTime()
  async downloadBackupDirect(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { buffer, fileName } = this.settingsService.takeManualBackupDownload(id);

      if (isDev) {
        this.logger.debug(`[backup/download-direct] sending ${buffer.length} bytes`);
      }

      if (res.headersSent) {
        return;
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      res.status(200).end(buffer);
    } catch (error) {
      this.logger.error(
        `[backup/download-direct] failed id=${id}: ${error?.message ?? error}`,
        error instanceof Error ? error.stack : undefined,
      );
      if (!res.headersSent) {
        throw error;
      }
      try {
        res.end();
      } catch {
        // connection closed
      }
    }
  }

  @Post('backup/restore')
  @Roles('ADMIN')
  @SkipResponseTime()
  @UseInterceptors(FileInterceptor('backupFile'))
  async restoreBackupUpload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_BACKUP_BYTES })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('فایل پشتیبان خالی است');
    }
    return this.settingsService.restoreBackupFromUpload(file.buffer);
  }

  @Get('backup-info')
  @Roles('ADMIN')
  async getBackupInfo() {
    return this.settingsService.getBackupInfo();
  }

  @Post('reset-database')
  @Roles('ADMIN')
  async resetDatabase() {
    return this.settingsService.resetDatabase();
  }

  @Get('financial-reports-password/status')
  @Roles('ADMIN')
  async getFinancialReportsPasswordStatus() {
    return this.financialReportsAccessService.getPasswordStatus();
  }

  @Post('financial-reports-password')
  @Roles('ADMIN')
  async setFinancialReportsPassword(
    @Req() req: any,
    @Body() dto: SetFinancialReportsPasswordDto,
  ) {
    return this.financialReportsAccessService.setPassword(
      req.user.id,
      dto.newPassword,
      dto.currentPassword,
    );
  }
}
