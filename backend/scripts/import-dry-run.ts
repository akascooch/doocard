import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import jalaali from 'jalaali-js';

const prisma = new PrismaClient();

const CONFIG = {
  excelPath: 'C:\\Users\\a.hosseini\\Desktop\\Data\\DATA1-7.xlsx',
  defaultTime: '10:00',
  testLimit: 10, // Only first 10 for dry run
};

// UserID → EmployeeID mapping
const userIdToEmployeeIdMap: Record<number, number> = {};

async function buildMapping() {
  const employees = await prisma.employee.findMany({
    include: { user: true },
  });

  employees.forEach(emp => {
    userIdToEmployeeIdMap[emp.userId] = emp.id;
  });
}

function parseAmount(amountStr: string | number): number {
  if (typeof amountStr === 'number') return amountStr;
  const cleaned = amountStr.replace(/,/g, '').trim();
  return parseInt(cleaned, 10);
}

async function getCalendarDateId(shamsiDate: string) {
  const [jy, jm, jd] = shamsiDate.split('/').map(Number);
  const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
  const gregorianDate = new Date(Date.UTC(gy, gm - 1, gd, 0, 0, 0, 0));
  const jalaliDateFormatted = `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;

  const calendarDate = await prisma.calendarDate.findUnique({
    where: { jalaliDate: jalaliDateFormatted },
  });

  return calendarDate ? { id: calendarDate.id, gregorianDate } : null;
}

async function dryRun() {
  console.log('🧪 DRY RUN - Testing with first 10 records\n');

  await buildMapping();

  const workbook = XLSX.readFile(CONFIG.excelPath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`📊 Total records in Excel: ${data.length}`);
  console.log(`🧪 Testing first ${CONFIG.testLimit} records\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < Math.min(CONFIG.testLimit, data.length); i++) {
    const row: any = data[i];
    const rowNum = i + 2;

    console.log(`\n📝 Row ${rowNum}:`);
    console.log(`   Shamsi Date: ${row.ShamsiDate}`);
    console.log(`   Customer: ${row.CustomerId}`);
    console.log(`   UserID: ${row.UserId} → EmployeeID: ${userIdToEmployeeIdMap[row.UserId] || '❌ NOT FOUND'}`);
    console.log(`   Service: ${row.ServiceId}`);
    console.log(`   Amount: ${row['ServiceAmount(ریال)']}`);

    try {
      const employeeId = userIdToEmployeeIdMap[row.UserId];
      if (!employeeId) throw new Error(`UserID ${row.UserId} not mapped`);

      const calendarData = await getCalendarDateId(row.ShamsiDate);
      if (!calendarData) throw new Error(`Calendar not found`);

      const [hours, minutes] = CONFIG.defaultTime.split(':').map(Number);
      const scheduledAt = new Date(calendarData.gregorianDate);
      scheduledAt.setUTCHours(hours, minutes, 0, 0);

      const amountRials = parseAmount(row['ServiceAmount(ریال)']);

      console.log(`   ✅ Gregorian: ${scheduledAt.toISOString()}`);
      console.log(`   ✅ Calendar ID: ${calendarData.id}`);
      console.log(`   ✅ Amount: ${amountRials} Rials`);
      console.log(`   ✅ Ready for insert!`);
      
      success++;
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 DRY RUN RESULT:`);
  console.log(`   ✅ Valid: ${success}/${CONFIG.testLimit}`);
  console.log(`   ❌ Invalid: ${failed}/${CONFIG.testLimit}`);
  console.log(`${'═'.repeat(60)}`);

  if (success === CONFIG.testLimit) {
    console.log(`\n✅ ALL TESTS PASSED! Ready for full import.`);
  } else {
    console.log(`\n⚠️  Some records have issues. Check logs above.`);
  }

  await prisma.$disconnect();
}

dryRun();

