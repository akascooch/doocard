import { Controller, Get, Post, Delete, Body, UseGuards, Res, UploadedFile, UseInterceptors, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { SettingsService } from './settings.service';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('logo')
  async getLogo() {
    return this.settingsService.getLogo();
  }

  @Get('logo-info')
  async getLogoInfo() {
    return this.settingsService.getLogoInfo();
  }

  @Post('upload-logo')
  @UseInterceptors(FileInterceptor('logo'))
  async uploadLogo(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }), // 2MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|gif|svg)' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.settingsService.uploadLogo(file);
  }

  @Delete('logo')
  async deleteLogo() {
    return this.settingsService.deleteLogo();
  }

  @Post('reset-database')
  @Roles('ADMIN')
  async resetDatabase() {
    return this.settingsService.resetDatabase();
  }

  @Post('backup')
  @Roles('ADMIN')
  async createBackup(@Res() res: Response) {
    try {
      const backupData = await this.settingsService.createBackup();
      
      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="backup-${new Date().toISOString().split('T')[0]}.json"`);
      
      res.json(backupData);
    } catch (error) {
      res.status(500).json({ error: 'خطا در ایجاد پشتیبان' });
    }
  }

  @Post('restore')
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('backupFile'))
  async restoreBackup(
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      console.log('🔄 Restore request received');
      console.log('📁 File info:', {
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      });
      
      const fileContent = file.buffer.toString();
      console.log('📄 File content length:', fileContent.length);
      console.log('📄 File content preview:', fileContent.substring(0, 200));
      
      const backupData = JSON.parse(fileContent);
      console.log('✅ JSON parsed successfully');
      console.log('📊 Backup data structure:', {
        hasTimestamp: !!backupData.timestamp,
        hasTables: !!backupData.tables,
        tableCount: Object.keys(backupData.tables || {}).length
      });
      
      const result = await this.settingsService.restoreBackup(backupData);
      console.log('✅ Restore completed successfully');
      return result;
    } catch (error) {
      console.error('❌ Error in restore:', error);
      if (error instanceof SyntaxError) {
        throw new Error('فایل پشتیبان JSON نامعتبر است');
      }
      throw new Error(`خطا در بازیابی: ${error.message}`);
    }
  }

  @Get('backup-info')
  @Roles('ADMIN')
  async getBackupInfo() {
    return this.settingsService.getBackupInfo();
  }

  @Post('test-restore')
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('backupFile'))
  async testRestore(
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      console.log('🧪 Test restore endpoint called');
      console.log('📁 File info:', {
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        bufferLength: file.buffer?.length
      });
      
      if (!file.buffer) {
        throw new Error('فایل buffer ندارد');
      }
      
      const fileContent = file.buffer.toString();
      console.log('📄 File content length:', fileContent.length);
      console.log('📄 File content preview:', fileContent.substring(0, 300));
      
      const backupData = JSON.parse(fileContent);
      console.log('✅ JSON parsed successfully');
      console.log('📊 Backup data keys:', Object.keys(backupData));
      
      return {
        success: true,
        message: 'فایل پشتیبان معتبر است',
        fileInfo: {
          name: file.originalname,
          size: file.size,
          contentLength: fileContent.length,
          hasTimestamp: !!backupData.timestamp,
          hasTables: !!backupData.tables,
          tableCount: Object.keys(backupData.tables || {}).length
        }
      };
    } catch (error) {
      console.error('❌ Error in test restore:', error);
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }
} 