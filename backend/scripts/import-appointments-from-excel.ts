import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import jalaali from 'jalaali-js';

const prisma = new PrismaClient();

// Configuration
const CONFIG = {
  excelPath: process.env.EXCEL_PATH || './DATA1-7.xlsx', // Server path
  defaultTime: '10:00', // Default time for appointments
  defaultStatus: 'SETTLED' as const, // PENDING | CONFIRMED | SETTLED | PAID
  batchSize: 100,
  logPath: './import-log.txt',
};

interface ExcelRow {
  ShamsiDate: string; // "1404/01/01"
  CustomerId: number;
  UserId: number; // This is user.id, need to map to employee.id
  'ServiceAmount(ریال)': string; // "15,000,000"
  ServiceId: number;
}

interface ImportStats {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; reason: string; data: any }>;
}

// Map UserID → EmployeeID
const userIdToEmployeeIdMap: Record<number, number> = {};

async function buildUserIdEmployeeIdMap() {
  console.log('🔄 Building UserID → EmployeeID mapping...\n');
  
  const employees = await prisma.employee.findMany({
    include: { user: true },
  });

  employees.forEach(emp => {
    userIdToEmployeeIdMap[emp.userId] = emp.id;
  });

  console.log('✅ Mapping created:');
  Object.entries(userIdToEmployeeIdMap).forEach(([userId, empId]) => {
    console.log(`   UserID ${userId} → EmployeeID ${empId}`);
  });
  console.log('');
}

/**
 * Parse ServiceAmount: "15,000,000" → 15000000
 */
function parseAmount(amountStr: string): number {
  if (typeof amountStr === 'number') return amountStr;
  const cleaned = amountStr.replace(/,/g, '').trim();
  return parseInt(cleaned, 10);
}

/**
 * Convert Jalali date to Gregorian and get calendar_date_id
 */
async function getCalendarDateId(shamsiDate: string): Promise<{ id: number; gregorianDate: Date } | null> {
  try {
    // Parse Jalali date: "1404/01/01"
    const [jy, jm, jd] = shamsiDate.split('/').map(Number);
    
    if (!jy || !jm || !jd) {
      console.error(`   ❌ Invalid Jalali format: ${shamsiDate}`);
      return null;
    }

    // Convert to Gregorian
    const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
    const gregorianDate = new Date(Date.UTC(gy, gm - 1, gd, 0, 0, 0, 0));
    
    // Format Jalali as YYYY-MM-DD
    const jalaliDateFormatted = `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;

    // Find in calendar_dates
    const calendarDate = await prisma.calendarDate.findUnique({
      where: { jalaliDate: jalaliDateFormatted },
    });

    if (!calendarDate) {
      console.error(`   ❌ Calendar date not found for: ${shamsiDate} (${jalaliDateFormatted})`);
      return null;
    }

    return { id: calendarDate.id, gregorianDate };
  } catch (error) {
    console.error(`   ❌ Error converting date ${shamsiDate}:`, error);
    return null;
  }
}

/**
 * Import appointments from Excel
 */
async function importAppointments() {
  console.log('📥 Starting Excel Import\n');
  console.log('═'.repeat(60));
  console.log(`📁 File: ${CONFIG.excelPath}`);
  console.log(`⏰ Default Time: ${CONFIG.defaultTime}`);
  console.log(`📊 Status: ${CONFIG.defaultStatus}`);
  console.log('═'.repeat(60), '\n');

  const stats: ImportStats = {
    total: 0,
    success: 0,
    failed: 0,
    errors: [],
  };

  const logStream = fs.createWriteStream(CONFIG.logPath, { flags: 'w' });
  const log = (message: string) => {
    console.log(message);
    logStream.write(message + '\n');
  };

  try {
    // Step 1: Build UserID → EmployeeID mapping
    await buildUserIdEmployeeIdMap();

    // Step 2: Read Excel
    log('📖 Reading Excel file...');
    const workbook = XLSX.readFile(CONFIG.excelPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);
    
    stats.total = data.length;
    log(`✅ Found ${stats.total} records\n`);

    // Step 3: Process in batches
    log('🔄 Processing appointments...\n');

    for (let i = 0; i < data.length; i += CONFIG.batchSize) {
      const batch = data.slice(i, i + CONFIG.batchSize);
      const batchNum = Math.floor(i / CONFIG.batchSize) + 1;
      
      log(`📦 Batch ${batchNum} (${batch.length} records)...`);

      for (const [index, row] of batch.entries()) {
        const rowNumber = i + index + 2; // +2 for header and 1-based indexing
        
        try {
          // Validate required fields
          if (!row.ShamsiDate || !row.CustomerId || !row.ServiceId) {
            throw new Error('Missing required fields');
          }

          // Map UserId to EmployeeId
          const employeeId = userIdToEmployeeIdMap[row.UserId];
          if (!employeeId) {
            throw new Error(`UserID ${row.UserId} not found in employee mapping`);
          }

          // Get calendar date
          const calendarData = await getCalendarDateId(row.ShamsiDate);
          if (!calendarData) {
            throw new Error(`Calendar date not found for ${row.ShamsiDate}`);
          }

          // Parse time
          const [hours, minutes] = CONFIG.defaultTime.split(':').map(Number);
          const scheduledAt = new Date(calendarData.gregorianDate);
          scheduledAt.setUTCHours(hours, minutes, 0, 0);

          // Parse amount
          const amountRials = parseAmount(row['ServiceAmount(ریال)']);

          // Randomize time for realism (9-17)
          const randomHour = 9 + Math.floor(Math.random() * 9); // 9-17
          const randomMin = [0, 30][Math.floor(Math.random() * 2)]; // 00 or 30
          const randomScheduledAt = new Date(calendarData.gregorianDate);
          randomScheduledAt.setUTCHours(randomHour, randomMin, 0, 0);

          // Create appointment
          await prisma.appointment.create({
            data: {
              customerId: row.CustomerId,
              employeeId,
              calendarDateId: calendarData.id,
              services: [
                {
                  serviceId: row.ServiceId,
                  priceAtBooking: amountRials, // Already in RIAL
                  durationMin: 60,
                },
              ],
              scheduledAt: randomScheduledAt,
              durationMin: 60,
              status: CONFIG.defaultStatus,
              amount: BigInt(amountRials), // Store in RIAL (no conversion!)
            },
          });

          stats.success++;
        } catch (error: any) {
          stats.failed++;
          const errorMsg = error.message || 'Unknown error';
          stats.errors.push({
            row: rowNumber,
            reason: errorMsg,
            data: row,
          });
          log(`   ❌ Row ${rowNumber}: ${errorMsg}`);
        }
      }

      log(`   ✅ Batch ${batchNum} complete: ${stats.success} success, ${stats.failed} failed\n`);
    }

    // Step 4: Summary
    log('\n' + '═'.repeat(60));
    log('📊 IMPORT SUMMARY');
    log('═'.repeat(60));
    log(`✅ Success: ${stats.success} / ${stats.total}`);
    log(`❌ Failed: ${stats.failed} / ${stats.total}`);
    log(`📈 Success Rate: ${((stats.success / stats.total) * 100).toFixed(2)}%`);
    
    if (stats.errors.length > 0) {
      log(`\n⚠️  First 10 Errors:`);
      stats.errors.slice(0, 10).forEach(err => {
        log(`   Row ${err.row}: ${err.reason}`);
      });
    }

    log(`\n📁 Full log: ${CONFIG.logPath}`);
    log('═'.repeat(60));

  } catch (error: any) {
    log(`\n❌ FATAL ERROR: ${error.message}`);
    throw error;
  } finally {
    logStream.end();
    await prisma.$disconnect();
  }
}

// Run import
importAppointments()
  .then(() => {
    console.log('\n✅ Import completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
