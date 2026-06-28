import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import * as jalaali from 'jalaali-js';
import * as crypto from 'crypto';
import {
  buildAppointmentDateGroupPreview,
  computeConservativeAppointmentDedupKey,
  deserializeAppointmentRow,
  filterDifferentialAppointmentDays,
  isRawServicesExportWorkbook,
  parseRawAppointmentWorkbookFromBuffer,
  serializeAppointmentRow,
  SerializedAppointmentRow,
} from './lib/appointment-workbook.parser';
import {
  commitEligibleAppointmentRows,
  ensureGenericImportCustomer,
  findExistingAppointmentDedupKeys,
  getAppointmentCountsByJalaliDates,
} from './lib/appointment-commit.lib';
import {
  dedupeCustomerRowsByPhone,
  parseCustomerWorkbookFromBuffer,
  SerializedCustomerRow,
} from './lib/customer-workbook.parser';
import {
  commitEligibleCustomerRows,
  findExistingCustomerPhones,
} from './lib/customer-commit.lib';

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

  /**
   * Preview customer workbook; stores eligible new-customer rows until commit.
   */
  async previewCustomers(buffer: Buffer, filename: string, userId: number) {
    const parsed = parseCustomerWorkbookFromBuffer(buffer, filename);
    const deduped = dedupeCustomerRowsByPhone(parsed.rows);

    const phones = deduped.eligible.map((r) => r.phone);
    const existingPhones = await findExistingCustomerPhones(this.prisma, phones);

    const eligible: SerializedCustomerRow[] = [];
    const existingInDbRows: Array<{ phone: string; rowNumber: number; name: string }> = [];

    for (const row of deduped.eligible) {
      if (existingPhones.has(row.phone)) {
        existingInDbRows.push({ phone: row.phone, rowNumber: row.rowNumber, name: row.name });
      } else {
        eligible.push(row);
      }
    }

    const duplicateCandidates: Array<{
      phone: string;
      rowNumbers: number[];
      reason: 'in_file' | 'existing_db' | 'both';
    }> = [];

    for (const dup of deduped.inFileDuplicatePhones) {
      duplicateCandidates.push({ phone: dup.phone, rowNumbers: dup.rowNumbers, reason: 'in_file' });
    }

    for (const row of existingInDbRows) {
      const hit = duplicateCandidates.find((d) => d.phone === row.phone);
      if (hit) hit.reason = 'both';
      else duplicateCandidates.push({ phone: row.phone, rowNumbers: [row.rowNumber], reason: 'existing_db' });
    }

    const batchId = `import-preview-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    await this.prisma.importJob.create({
      data: {
        userId,
        entity: 'CUSTOMERS',
        filename,
        batchId,
        totalRows: eligible.length,
        status: 'PENDING',
        metadata: {
          workflow: 'customer-template',
          previewVersion: 1,
          headerRowIndex: parsed.headerRowIndex,
          parseFailureCount: parsed.failures.length,
          eligibleRows: eligible,
          confirmed: false,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      previewToken: batchId,
      filename,
      headerRowIndex: parsed.headerRowIndex,
      totalDataRows: parsed.totalDataRows,
      parsedRows: parsed.rows.length,
      parseFailures: parsed.failures.map((f) => ({
        rowNumber: f.rowNumber,
        reason: f.reason,
        phone: f.phone,
      })),
      parseFailureCount: parsed.failures.length,
      newCustomerCount: eligible.length,
      eligibleRowCount: eligible.length,
      existingInDbCount: existingInDbRows.length,
      inFileDuplicateCount: deduped.inFileDuplicateRowNumbers.length,
      duplicatePhones: duplicateCandidates.slice(0, 100),
      canCommit: eligible.length > 0,
      requiresConfirmation: true,
    };
  }

  /**
   * Commit a previously previewed customer import.
   */
  async commitCustomers(batchId: string, userId: number) {
    const job = await this.prisma.importJob.findUnique({ where: { batchId } });
    if (!job) {
      throw new NotFoundException('پیش‌نمایش import یافت نشد. لطفاً فایل را دوباره آپلود کنید.');
    }
    if (job.userId !== userId) {
      throw new ForbiddenException('شما مجاز به تأیید این import نیستید');
    }
    if (job.entity !== 'CUSTOMERS') {
      throw new BadRequestException('این batch مربوط به مشتریان نیست');
    }
    if (job.status !== 'PENDING') {
      throw new BadRequestException('این import قبلاً پردازش شده یا منقضی شده است');
    }

    const metadata = (job.metadata ?? {}) as {
      eligibleRows?: SerializedCustomerRow[];
      confirmed?: boolean;
    };
    const eligibleRows = metadata.eligibleRows ?? [];
    if (!eligibleRows.length) {
      throw new BadRequestException('ردیف قابل import یافت نشد');
    }

    await this.prisma.importJob.update({
      where: { batchId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    try {
      const result = await commitEligibleCustomerRows(this.prisma, eligibleRows);

      await this.prisma.importJob.update({
        where: { batchId },
        data: {
          status: 'COMPLETED',
          created: result.created,
          failed: result.failed,
          finishedAt: new Date(),
          metadata: {
            ...metadata,
            confirmed: true,
            confirmedAt: new Date().toISOString(),
            importResult: JSON.parse(JSON.stringify(result)),
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        batchId,
        ...result,
        skippedDuplicate: result.skippedDuplicate + result.skippedExisting,
      };
    } catch (error) {
      await this.prisma.importJob.update({
        where: { batchId },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          metadata: {
            ...metadata,
            error: error instanceof Error ? error.message : String(error),
          } as unknown as Prisma.InputJsonValue,
        },
      });
      throw error;
    }
  }

  /**
   * Preview raw third-party services export (ارائه خدمات shape).
   * Stores eligible rows server-side until explicit commit.
   */
  async previewRawAppointments(buffer: Buffer, filename: string, userId: number) {
    if (!isRawServicesExportWorkbook(buffer)) {
      throw new BadRequestException(
        'فرمت فایل شناسایی نشد. فایل باید خروجی خام «ارائه خدمات» با ستون‌های تاریخ، کارمند و نام/فاکتور باشد.',
      );
    }

    const parsed = parseRawAppointmentWorkbookFromBuffer(buffer, filename);
    await ensureGenericImportCustomer(this.prisma);

    const uniqueDates = [...new Set(parsed.rows.map((r) => r.jalaliDateKey))];
    const dbCountByDate = await getAppointmentCountsByJalaliDates(this.prisma, uniqueDates);
    const filtered = filterDifferentialAppointmentDays(parsed.rows, dbCountByDate);

    const inFileKeyCounts = new Map<string, number>();
    const inFileKeyToRows = new Map<string, number[]>();
    for (const row of filtered.eligible) {
      const key = computeConservativeAppointmentDedupKey(row, 0);
      inFileKeyCounts.set(key, (inFileKeyCounts.get(key) || 0) + 1);
      const rows = inFileKeyToRows.get(key) ?? [];
      rows.push(row.rowNumber);
      inFileKeyToRows.set(key, rows);
    }

    const uniqueKeys = [...inFileKeyCounts.keys()];
    const existingInDb = await findExistingAppointmentDedupKeys(this.prisma, uniqueKeys);

    const duplicateCandidates: Array<{
      dedupKey: string;
      rowNumbers: number[];
      reason: 'in_file' | 'existing_db' | 'both';
    }> = [];

    const duplicateRowNumbers = new Set<number>();

    for (const [key, count] of inFileKeyCounts.entries()) {
      const rowNumbers = inFileKeyToRows.get(key) ?? [];
      const inFile = count > 1;
      const inDb = existingInDb.has(key);
      if (!inFile && !inDb) continue;

      let reason: 'in_file' | 'existing_db' | 'both' = inFile ? 'in_file' : 'existing_db';
      if (inFile && inDb) reason = 'both';
      duplicateCandidates.push({ dedupKey: key, rowNumbers, reason });
      for (const n of rowNumbers) duplicateRowNumbers.add(n);
    }

    const dateGroups = buildAppointmentDateGroupPreview(
      parsed.rows,
      filtered.skippedMatchedDays,
      dbCountByDate,
      duplicateRowNumbers,
    );

    const batchId = `import-preview-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const eligibleSerialized = filtered.eligible.map(serializeAppointmentRow);

    await this.prisma.importJob.create({
      data: {
        userId,
        entity: 'APPOINTMENTS',
        filename,
        batchId,
        totalRows: filtered.eligible.length,
        status: 'PENDING',
        metadata: {
          workflow: 'raw-services-export',
          previewVersion: 2,
          headerRowIndex: parsed.headerRowIndex,
          parseFailureCount: parsed.failures.length,
          skippedMatchedRowCount: filtered.skippedRowCount,
          skippedMatchedDays: JSON.parse(JSON.stringify(filtered.skippedMatchedDays)),
          eligibleRows: eligibleSerialized,
          confirmed: false,
        } as Prisma.InputJsonValue,
      },
    });

    const inFileDuplicateRows = [...inFileKeyCounts.values()]
      .filter((c) => c > 1)
      .reduce((sum, c) => sum + (c - 1), 0);

    return {
      previewToken: batchId,
      filename,
      format: parsed.format,
      headerRowIndex: parsed.headerRowIndex,
      totalDataRows: parsed.totalDataRows,
      parsedRows: parsed.rows.length,
      parseFailures: parsed.failures.map((f) => ({
        rowNumber: f.rowNumber,
        reason: f.reason,
        jalaliDateRaw: f.jalaliDateRaw,
      })),
      parseFailureCount: parsed.failures.length,
      skippedMatchedDays: filtered.skippedMatchedDays,
      skippedMatchedRowCount: filtered.skippedRowCount,
      /** @deprecated use skippedMatchedRowCount */
      skippedSingletonDays: filtered.skippedMatchedDays,
      skippedSingletonRowCount: filtered.skippedRowCount,
      eligibleRowCount: filtered.eligible.length,
      duplicateRowCount: duplicateRowNumbers.size,
      inFileDuplicateRows,
      existingDbDuplicateKeys: existingInDb.size,
      duplicateCandidates: duplicateCandidates.slice(0, 100),
      dateGroups,
      canCommit: filtered.eligible.length > 0,
      requiresConfirmation: true,
    };
  }

  /**
   * Commit a previously previewed appointment import (requires previewToken).
   */
  async commitAppointments(
    batchId: string,
    userId: number,
    options: { createMissing?: boolean; createIncomeTx?: boolean } = {},
  ) {
    const job = await this.prisma.importJob.findUnique({ where: { batchId } });
    if (!job) {
      throw new NotFoundException('پیش‌نمایش import یافت نشد. لطفاً فایل را دوباره آپلود کنید.');
    }
    if (job.userId !== userId) {
      throw new ForbiddenException('شما مجاز به تأیید این import نیستید');
    }
    if (job.entity !== 'APPOINTMENTS') {
      throw new BadRequestException('این batch مربوط به نوبت‌ها نیست');
    }
    if (job.status !== 'PENDING') {
      throw new BadRequestException('این import قبلاً پردازش شده یا منقضی شده است');
    }

    const metadata = (job.metadata ?? {}) as {
      eligibleRows?: SerializedAppointmentRow[];
      confirmed?: boolean;
    };
    const eligibleSerialized = metadata.eligibleRows ?? [];
    if (!eligibleSerialized.length) {
      throw new BadRequestException('ردیف قابل import یافت نشد');
    }

    const rows = eligibleSerialized.map(deserializeAppointmentRow);

    await this.prisma.importJob.update({
      where: { batchId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    try {
      const result = await commitEligibleAppointmentRows(this.prisma, batchId, rows, {
        createMissing: options.createMissing !== false,
        createIncomeTx: options.createIncomeTx !== false,
      });

      await this.prisma.importJob.update({
        where: { batchId },
        data: {
          status: 'COMPLETED',
          created: result.created,
          failed: result.failed,
          finishedAt: new Date(),
          metadata: {
            ...metadata,
            confirmed: true,
            confirmedAt: new Date().toISOString(),
            importResult: JSON.parse(JSON.stringify(result)),
          } as Prisma.InputJsonValue,
        },
      });

      return {
        batchId,
        ...result,
        skippedMatchedNote:
          'تاریخ‌هایی که تعداد نوبت Excel با DB برابر بود در پیش‌نمایش حذف شده‌اند.',
      };
    } catch (error) {
      await this.prisma.importJob.update({
        where: { batchId },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          metadata: {
            ...metadata,
            error: error instanceof Error ? error.message : String(error),
          },
        },
      });
      throw error;
    }
  }
}

