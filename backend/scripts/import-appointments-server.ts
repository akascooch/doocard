#!/usr/bin/env ts-node
/**
 * Import Appointments from Excel file - SERVER VERSION
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const prisma = new PrismaClient();

// Excel file path - SERVER
const EXCEL_FILE_PATH = '/tmp/Appointments.xls';
const LOG_FILE_PATH = '/var/www/doocard/import_appointments.log';

interface ExcelRow {
  rowNumber: number;
  date: string;
  customerMobile: string;
  employeeMobile: string;
  price: number;
  serviceName: string;
  serviceId: number;
}

interface ImportResult {
  totalRows: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; reason: string; data: any }>;
}

const result: ImportResult = {
  totalRows: 0,
  imported: 0,
  skipped: 0,
  errors: [],
};

function jalaliToGregorian(jalaliStr: string): Date | null {
  try {
    const parts = jalaliStr.split(/[\/\-]/);
    if (parts.length !== 3) return null;

    const jy = parseInt(parts[0]);
    const jm = parseInt(parts[1]);
    const jd = parseInt(parts[2]);

    if (isNaN(jy) || isNaN(jm) || isNaN(jd)) return null;

    // Simple approximation
    const gy = jy + 621;
    const date = new Date(gy, jm - 1, jd, 12, 0, 0);
    
    return date;
  } catch {
    return null;
  }
}

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question + ' (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

function writeLog() {
  const logContent = `
===========================================
Import Appointments - ${new Date().toISOString()}
===========================================

📊 Summary:
- Total rows: ${result.totalRows}
- Imported: ${result.imported}
- Skipped: ${result.skipped}
- Success rate: ${result.totalRows > 0 ? ((result.imported / result.totalRows) * 100).toFixed(2) : 0}%

${result.errors.length > 0 ? `
⚠️ Errors (${result.errors.length}):
${result.errors.map((e, i) => `
${i + 1}. Row ${e.row}: ${e.reason}
`).join('\n')}
` : '✅ No errors'}

===========================================
`;

  fs.writeFileSync(LOG_FILE_PATH, logContent, 'utf-8');
  console.log(`\n💾 Log saved to: ${LOG_FILE_PATH}`);
}

async function importAppointments() {
  console.log('\n📊 Import Appointments to Production Server\n');
  console.log('Excel file:', EXCEL_FILE_PATH);

  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    console.error('❌ Excel file not found:', EXCEL_FILE_PATH);
    process.exit(1);
  }

  console.log('✅ Excel file found\n');

  console.log('⚠️  WARNING: This will CLEAR all existing appointments on PRODUCTION!\n');
  const confirmClear = await askConfirmation('Do you want to proceed?');
  
  if (!confirmClear) {
    console.log('❌ Import cancelled');
    process.exit(0);
  }

  try {
    console.log('\n🗑️  Clearing appointments table...');
    const deletedCount = await prisma.appointment.deleteMany({});
    console.log(`✅ Deleted ${deletedCount.count} existing appointments\n`);

    console.log('📖 Reading Excel file...');
    const fileBuffer = fs.readFileSync(EXCEL_FILE_PATH);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', codepage: 65001 });
    const jsonData: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    
    console.log(`✅ Loaded ${jsonData.length - 1} data rows\n`);

    const rows: ExcelRow[] = [];
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      let priceStr = row[3]?.toString() || '0';
      priceStr = priceStr.replace(/,/g, '');
      
      rows.push({
        rowNumber: i + 1,
        date: row[0]?.toString() || '',
        customerMobile: row[1]?.toString().replace(/\s/g, '') || '',
        employeeMobile: row[2]?.toString().replace(/\s/g, '') || '',
        price: parseFloat(priceStr),
        serviceName: row[4]?.toString() || '',
        serviceId: parseInt(row[5]?.toString() || '0'),
      });
    }

    result.totalRows = rows.length;
    console.log('🔄 Processing rows...\n');

    for (const row of rows) {
      if (row.rowNumber % 500 === 0) {
        console.log(`📊 Progress: ${row.rowNumber}/${result.totalRows} (${((row.rowNumber / result.totalRows) * 100).toFixed(1)}%)`);
      }

      try {
        if (!row.date || !row.customerMobile || !row.employeeMobile) {
          result.skipped++;
          result.errors.push({ row: row.rowNumber, reason: 'Missing data', data: row });
          continue;
        }

        const gregorianDate = jalaliToGregorian(row.date);
        if (!gregorianDate) {
          result.skipped++;
          result.errors.push({ row: row.rowNumber, reason: 'Invalid date', data: row });
          continue;
        }

        const customer = await prisma.customer.findFirst({
          where: { user: { phone: row.customerMobile } },
          include: { user: true },
        });

        if (!customer) {
          result.skipped++;
          result.errors.push({ row: row.rowNumber, reason: `Customer not found: ${row.customerMobile}`, data: row });
          continue;
        }

        const employee = await prisma.employee.findFirst({
          where: { user: { phone: row.employeeMobile } },
          include: { user: true },
        });

        if (!employee) {
          result.skipped++;
          result.errors.push({ row: row.rowNumber, reason: `Employee not found: ${row.employeeMobile}`, data: row });
          continue;
        }

        const service = await prisma.service.findUnique({
          where: { id: row.serviceId },
        });

        if (!service) {
          result.skipped++;
          result.errors.push({ row: row.rowNumber, reason: `Service not found: ${row.serviceId}`, data: row });
          continue;
        }

        const normalizedPrice = Math.round(row.price / 10);
        const servicesJson = [{
          serviceId: service.id,
          priceAtBooking: normalizedPrice,
          durationMin: service.durationMinutes || 60,
          serviceName: service.name,
        }];

        const appointment = await prisma.appointment.create({
          data: {
            customerId: customer.id,
            employeeId: employee.id,
            scheduledAt: gregorianDate,
            durationMin: service.durationMinutes || 60,
            status: 'COMPLETED',
            services: servicesJson,
            amount: BigInt(normalizedPrice),
            paidAt: gregorianDate,
            paymentMethod: 'CASH',
          },
        });

        await prisma.appointmentService.create({
          data: {
            appointmentId: appointment.id,
            serviceId: service.id,
            price: normalizedPrice,
          },
        });

        result.imported++;
      } catch (error) {
        result.skipped++;
        result.errors.push({ row: row.rowNumber, reason: error.message, data: row });
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Import Summary:\n');
    console.log(`✅ ${result.imported} appointments imported`);
    console.log(`⚠️  ${result.skipped} rows skipped`);
    console.log(`✨ Success rate: ${((result.imported / result.totalRows) * 100).toFixed(2)}%`);
    console.log('='.repeat(50) + '\n');

    writeLog();

  } catch (error) {
    console.error('\n❌ Error:', error);
    writeLog();
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

importAppointments()
  .then(() => {
    console.log('\n✅ Import completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

