import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import * as jalaali from 'jalaali-js';

@Injectable()
export class ImportService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate Excel template for customers
   */
  async generateCustomersTemplate(): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('customers');

    // Header row
    worksheet.columns = [
      { header: 'نام', key: 'name', width: 20 },
      { header: 'تلفن', key: 'phone', width: 15 },
      { header: 'ایمیل', key: 'email', width: 25 },
      { header: 'تاریخ تولد (۱۴۰۰/۰۱/۰۱)', key: 'birthdate', width: 20 },
      { header: 'یادداشت', key: 'notes', width: 30 },
    ];

    // Sample row
    worksheet.addRow({
      name: 'علی احمدی',
      phone: '09121234567',
      email: 'ali@example.com',
      birthdate: '1370/05/15',
      notes: 'مشتری نمونه',
    });

    // Style
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFA1D1B1' },
    };

    return workbook;
  }

  /**
   * Parse Jalali date to ISO UTC
   * Format: YYYY/MM/DD or YYYY-MM-DD
   */
  parseJalaliDate(jalaliStr: string): Date | null {
    if (!jalaliStr) return null;
    
    try {
      // Parse Jalali date (format: YYYY/MM/DD or YYYY-MM-DD)
      const normalized = jalaliStr.trim().replace(/-/g, '/');
      const parts = normalized.split('/');
      
      if (parts.length !== 3) return null;
      
      const jy = parseInt(parts[0]); // Jalali year
      const jm = parseInt(parts[1]); // Jalali month
      const jd = parseInt(parts[2]); // Jalali day
      
      // Convert to Gregorian using jalaali-js
      const gregorian = jalaali.toGregorian(jy, jm, jd);
      
      // Create Date object
      const date = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
      
      return date;
    } catch (error) {
      console.error('Error parsing Jalali date:', jalaliStr, error);
      return null;
    }
  }

  /**
   * Parse customers from Excel buffer
   */
  async parseCustomersExcel(buffer: Buffer, dryRun: boolean = true) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    
    const worksheet = workbook.getWorksheet('customers') || workbook.worksheets[0];
    
    const rows: any[] = [];
    const errors: any[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const rowData = {
        rowNumber,
        name: row.getCell(1).value?.toString() || '',
        phone: row.getCell(2).value?.toString() || '',
        email: row.getCell(3).value?.toString() || '',
        birthdate: row.getCell(4).value?.toString() || '',
        notes: row.getCell(5).value?.toString() || '',
      };

      // Validation
      const rowErrors: string[] = [];

      if (!rowData.name || rowData.name.length < 2) {
        rowErrors.push('نام الزامی است و باید حداقل 2 کاراکتر باشد');
      }

      if (!rowData.phone || !/^09\d{9}$/.test(rowData.phone.replace(/\s/g, ''))) {
        rowErrors.push('شماره تلفن معتبر نیست (باید 11 رقم و با 09 شروع شود)');
      }

      if (rowData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rowData.email)) {
        rowErrors.push('ایمیل معتبر نیست');
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: rowNumber,
          data: rowData,
          errors: rowErrors,
        });
      } else {
        rows.push(rowData);
      }
    });

    return {
      totalRows: rows.length + errors.length,
      validRows: rows.length,
      errorRows: errors.length,
      rows,
      errors,
    };
  }

  /**
   * Import customers to database
   */
  async importCustomers(rows: any[], userId: number, batchId: string) {
    let created = 0;
    let updated = 0;
    let failed = 0;
    const failedRows: any[] = [];

    for (const row of rows) {
      try {
        // Check if user exists by phone
        const existingUser = await this.prisma.user.findUnique({
          where: { phone: row.phone },
        });

        if (existingUser) {
          // Update existing
          await this.prisma.customer.update({
            where: { userId: existingUser.id },
            data: {
              birthdate: row.birthdate ? this.parseJalaliDate(row.birthdate) : null,
              notes: row.notes || null,
            },
          });
          updated++;
        } else {
          // Create new
          const user = await this.prisma.user.create({
            data: {
              name: row.name,
              phone: row.phone,
              email: row.email || null,
              password: await this.hashPassword('123456'), // Default password
              role: 'CUSTOMER',
            },
          });

          await this.prisma.customer.create({
            data: {
              userId: user.id,
              birthdate: row.birthdate ? this.parseJalaliDate(row.birthdate) : null,
              notes: row.notes || null,
            },
          });
          created++;
        }
      } catch (error) {
        console.error('Error importing row:', row, error);
        failed++;
        failedRows.push({
          ...row,
          error: error.message,
        });
      }
    }

    // Create import job record
    await this.prisma.importJob.create({
      data: {
        userId,
        entity: 'CUSTOMERS',
        filename: 'customers-import.xlsx',
        batchId,
        totalRows: rows.length,
        created,
        updated,
        failed,
        status: failed > 0 ? 'COMPLETED' : 'COMPLETED',
        finishedAt: new Date(),
      },
    });

    return {
      created,
      updated,
      failed,
      failedRows,
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const bcrypt = require('bcrypt');
    return bcrypt.hash(password, 10);
  }
}

