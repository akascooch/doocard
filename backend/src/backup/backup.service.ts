import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;
  private readonly maxBackups: number;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.backupDir = this.config.get('backup.localPath') || './backups';
    this.maxBackups = this.config.get('backup.retention') || 30;
    
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create a complete backup of the system
   */
  async createBackup(): Promise<string> {
    try {
      this.logger.log('Starting system backup...');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `mova-backup-${timestamp}.json`;
      const backupPath = path.join(this.backupDir, backupFileName);
      
      // Get all data from database
      const backupData = await this.getAllData();
      
      // Write backup to file
      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
      
      // Compress backup file
      await this.compressBackup(backupPath);
      
      // Clean old backups
      await this.cleanOldBackups();
      
      this.logger.log(`Backup completed: ${backupFileName}`);
      return backupFileName;
      
    } catch (error) {
      this.logger.error('Backup failed:', error);
      throw new Error(`Backup failed: ${error.message}`);
    }
  }

  /**
   * Restore system from backup
   */
  async restoreBackup(backupFileName: string): Promise<void> {
    try {
      this.logger.log(`Starting system restore from: ${backupFileName}`);
      
      const backupPath = path.join(this.backupDir, backupFileName);
      
      if (!fs.existsSync(backupPath)) {
        throw new Error('Backup file not found');
      }
      
      // Read and parse backup file
      const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      
      // Validate backup data
      this.validateBackupData(backupData);
      
      // Restore data to database
      await this.restoreData(backupData);
      
      this.logger.log('System restore completed successfully');
      
    } catch (error) {
      this.logger.error('Restore failed:', error);
      throw new Error(`Restore failed: ${error.message}`);
    }
  }

  /**
   * Get list of available backups
   */
  async getBackups(): Promise<Array<{ name: string; size: number; createdAt: Date }>> {
    try {
      const files = fs.readdirSync(this.backupDir);
      const backups = [];
      
      for (const file of files) {
        if (file.endsWith('.json') || file.endsWith('.json.gz')) {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);
          
          backups.push({
            name: file,
            size: stats.size,
            createdAt: stats.birthtime,
          });
        }
      }
      
      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    } catch (error) {
      this.logger.error('Failed to get backups:', error);
      throw new Error(`Failed to get backups: ${error.message}`);
    }
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupFileName: string): Promise<void> {
    try {
      const backupPath = path.join(this.backupDir, backupFileName);
      
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
        this.logger.log(`Backup deleted: ${backupFileName}`);
      } else {
        throw new Error('Backup file not found');
      }
      
    } catch (error) {
      this.logger.error('Failed to delete backup:', error);
      throw new Error(`Failed to delete backup: ${error.message}`);
    }
  }

  /**
   * Scheduled backup (daily at 2 AM)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledBackup() {
    try {
      if (this.config.get('backup.enabled') === 'true') {
        await this.createBackup();
        this.logger.log('Scheduled backup completed');
      }
    } catch (error) {
      this.logger.error('Scheduled backup failed:', error);
    }
  }

  /**
   * Get all data from database for backup
   */
  private async getAllData() {
    const backupData: any = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      tables: {}
    };

    // Get all table names
    const tables = [
      'users', 'customers', 'barbers', 'services', 'appointments',
      'appointment_services', 'transactions', 'financial_entries',
      'financial_categories', 'bank_accounts', 'salaries',
      'tip_transactions', 'barber_withdrawal_requests', 'permissions',
      'sms_logs', 'sms_settings', 'sms_templates', 'settings'
    ];

    for (const table of tables) {
      try {
        const data = await this.prisma.$queryRawUnsafe(`SELECT * FROM "${table}"`);
        backupData.tables[table] = data;
      } catch (error) {
        this.logger.warn(`Failed to backup table ${table}:`, error);
        backupData.tables[table] = [];
      }
    }

    return backupData;
  }

  /**
   * Restore data to database
   */
  private async restoreData(backupData: any) {
    // Disable foreign key checks temporarily
    await this.prisma.$executeRaw`SET session_replication_role = replica`;
    
    try {
      // Clear existing data
      for (const table of Object.keys(backupData.tables)) {
        await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
      }
      
      // Restore data
      for (const [table, data] of Object.entries(backupData.tables)) {
        if (Array.isArray(data) && data.length > 0) {
          // Use Prisma's createMany for better performance
          const modelName = this.getModelName(table);
          if (modelName) {
            await this.prisma[modelName].createMany({
              data: data as any[],
              skipDuplicates: true,
            });
          }
        }
      }
      
    } finally {
      // Re-enable foreign key checks
      await this.prisma.$executeRaw`SET session_replication_role = DEFAULT`;
    }
  }

  /**
   * Validate backup data structure
   */
  private validateBackupData(backupData: any) {
    if (!backupData.version || !backupData.timestamp || !backupData.tables) {
      throw new Error('Invalid backup data format');
    }
    
    if (typeof backupData.tables !== 'object') {
      throw new Error('Invalid tables data in backup');
    }
  }

  /**
   * Get Prisma model name from table name
   */
  private getModelName(tableName: string): string | null {
    const modelMap: { [key: string]: string } = {
      'users': 'user',
      'customers': 'customer',
      'barbers': 'barber',
      'services': 'service',
      'appointments': 'appointment',
      'appointment_services': 'appointmentService',
      'transactions': 'transaction',
      'financial_entries': 'financialEntry',
      'financial_categories': 'financialCategory',
      'bank_accounts': 'bankAccount',
      'salaries': 'salary',
      'tip_transactions': 'tipTransaction',
      'barber_withdrawal_requests': 'barberWithdrawalRequest',
      'permissions': 'permission',
      'sms_logs': 'smsLog',
      'sms_settings': 'smsSettings',
      'sms_templates': 'smsTemplate',
      'settings': 'setting'
    };
    
    return modelMap[tableName] || null;
  }

  /**
   * Compress backup file
   */
  private async compressBackup(filePath: string): Promise<void> {
    try {
      await execAsync(`gzip -f "${filePath}"`);
      this.logger.log(`Backup compressed: ${filePath}.gz`);
    } catch (error) {
      this.logger.warn('Failed to compress backup:', error);
    }
  }

  /**
   * Clean old backups based on retention policy
   */
  private async cleanOldBackups(): Promise<void> {
    try {
      const backups = await this.getBackups();
      
      if (backups.length > this.maxBackups) {
        const backupsToDelete = backups.slice(this.maxBackups);
        
        for (const backup of backupsToDelete) {
          await this.deleteBackup(backup.name);
        }
        
        this.logger.log(`Cleaned ${backupsToDelete.length} old backups`);
      }
      
    } catch (error) {
      this.logger.error('Failed to clean old backups:', error);
    }
  }
}
