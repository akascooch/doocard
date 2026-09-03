import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as jalaali from 'jalaali-js';
import * as bcrypt from 'bcrypt';
import { join } from 'path';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();

// Utility: Convert Jalali to Gregorian Date
function jalaliToDate(jalaliStr: string): Date | null {
  if (!jalaliStr) return null;
  
  try {
    const normalized = jalaliStr.trim().replace(/-/g, '/');
    const parts = normalized.split('/');
    
    if (parts.length !== 3) return null;
    
    const jy = parseInt(parts[0]);
    const jm = parseInt(parts[1]);
    const jd = parseInt(parts[2]);
    
    const gregorian = jalaali.toGregorian(jy, jm, jd);
    return new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
  } catch (error) {
    console.error('❌ Error parsing Jalali date:', jalaliStr, error);
    return null;
  }
}

// Utility: Convert Toman to Rial
function tomanToRial(tomanStr: string | number): number {
  if (typeof tomanStr === 'number') return tomanStr * 10;
  
  const cleaned = tomanStr.toString()
    .replace(/,/g, '')
    .replace(/تومان/g, '')
    .trim();
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num * 10;
}

// Utility: Resolve existing employee only (import must never create barbers/employees)
async function findExistingEmployee(name: string): Promise<number> {
  if (!name || name.trim() === '') {
    throw new Error('نام کارمند خالی است');
  }

  // Try to find existing employee
  const existing = await prisma.employee.findFirst({
    where: {
      user: {
        name: {
          equals: name.trim(),
          mode: 'insensitive',
        },
      },
    },
    include: { user: true },
  });

  if (existing) {
    console.log(`✓ Employee found: ${name} (id: ${existing.id})`);
    return existing.id;
  }

  throw new Error(`آرایشگر/کارمند "${name.trim()}" در سیستم وجود ندارد. ایمپورت متوقف شد.`);
}

// Utility: Find or create customer
async function findOrCreateCustomer(name: string, phone?: string): Promise<number> {
  if (!name || name.trim() === '') {
    throw new Error('نام مشتری خالی است');
  }

  // Try to find by phone first
  if (phone) {
    const existing = await prisma.customer.findFirst({
      where: {
        user: { phone },
      },
    });

    if (existing) {
      console.log(`✓ Customer found by phone: ${name}`);
      return existing.id;
    }
  }

  // Try to find by name
  const existingByName = await prisma.customer.findFirst({
    where: {
      user: {
        name: {
          equals: name.trim(),
          mode: 'insensitive',
        },
      },
    },
  });

  if (existingByName) {
    console.log(`✓ Customer found by name: ${name}`);
    return existingByName.id;
  }

  // Create new customer
  console.log(`➕ Creating new customer: ${name}`);
  
  const customerPhone = phone || `09${Math.floor(100000000 + Math.random() * 900000000)}`;
  const hashedPassword = await bcrypt.hash('123654', 10);

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      phone: customerPhone,
      password: hashedPassword,
      role: 'CUSTOMER',
    },
  });

  const customer = await prisma.customer.create({
    data: {
      userId: user.id,
    },
  });

  console.log(`✅ Customer created: ${name} (id: ${customer.id})`);
  return customer.id;
}

// Utility: Find or create category
async function findOrCreateCategory(name: string, type: 'INCOME' | 'EXPENSE'): Promise<number> {
  const existing = await prisma.transactionCategory.findFirst({
    where: {
      name: {
        equals: name.trim(),
        mode: 'insensitive',
      },
      type,
    },
  });

  if (existing) return existing.id;

  const category = await prisma.transactionCategory.create({
    data: {
      name: name.trim(),
      type,
    },
  });

  console.log(`✅ Category created: ${name} (${type})`);
  return category.id;
}

// Utility: Find or create bank account
async function findOrCreateAccount(name: string): Promise<number> {
  const existing = await prisma.bankAccount.findFirst({
    where: {
      name: {
        equals: name.trim(),
        mode: 'insensitive',
      },
    },
  });

  if (existing) return existing.id;

  const account = await prisma.bankAccount.create({
    data: {
      name: name.trim(),
      accountNo: `ACC-${Date.now()}`,
      balance: BigInt(0),
      isActive: true,
    },
  });

  console.log(`✅ Account created: ${name}`);
  return account.id;
}

// Import Appointments
async function importAppointments(filePath: string) {
  console.log('\n📅 ===== IMPORTING APPOINTMENTS =====\n');
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const worksheet = workbook.worksheets[0];
  const rows: any[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    rows.push({
      rowNumber,
      customerName: row.getCell(1).value?.toString() || '',
      employeeName: row.getCell(2).value?.toString() || '',
      services: row.getCell(3).value?.toString() || '',
      date: row.getCell(4).value?.toString() || '',
      time: row.getCell(5).value?.toString() || '',
      status: row.getCell(6).value?.toString() || 'PENDING',
      paymentMethod: row.getCell(7).value?.toString() || 'CASH',
      amount: row.getCell(8).value?.toString() || '0',
      tip: row.getCell(9).value?.toString() || '0',
    });
  });

  let created = 0;
  let skipped = 0;
  const errors: any[] = [];

  for (const row of rows) {
    try {
      // Validate required fields
      if (!row.customerName || !row.employeeName || !row.date || !row.time) {
        throw new Error('فیلدهای الزامی خالی است');
      }

      // Must match an existing employee; importer is not allowed to create barbers
      const employeeId = await findExistingEmployee(row.employeeName);

      // Find/create customer
      const customerId = await findOrCreateCustomer(row.customerName);

      // Parse date and time
      const appointmentDate = jalaliToDate(row.date);
      if (!appointmentDate) {
        throw new Error(`تاریخ نامعتبر: ${row.date}`);
      }

      // Combine date + time
      const [hour, minute] = row.time.split(':').map((s: string) => parseInt(s));
      appointmentDate.setHours(hour || 10, minute || 0, 0, 0);

      // Parse amounts
      const amount = tomanToRial(row.amount);
      const tipAmount = tomanToRial(row.tip);

      // Parse services (simple version - store as JSON)
      const services = row.services.split(',').map((s: string) => ({
        serviceName: s.trim(),
        priceAtBooking: 0,
        durationMin: 30,
      }));

      // Create appointment
      await prisma.appointment.create({
        data: {
          customerId,
          employeeId,
          services: services as any,
          scheduledAt: appointmentDate,
          durationMin: services.length * 30,
          status: row.status.toUpperCase() || 'PENDING',
          amount: amount > 0 ? BigInt(amount) : null,
          tipAmount: tipAmount > 0 ? BigInt(tipAmount) : null,
          paymentMethod: row.paymentMethod.toUpperCase() || null,
        },
      });

      created++;
      console.log(`✅ Row ${row.rowNumber}: Appointment created for ${row.customerName}`);
    } catch (error: any) {
      skipped++;
      const errorMsg = `Row ${row.rowNumber}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  console.log(`\n📊 Appointments Summary:`);
  console.log(`   ✅ Created: ${created}`);
  console.log(`   ⚠️  Skipped: ${skipped}`);
  
  return { created, skipped, errors };
}

// Import Transactions (Pays)
async function importTransactions(filePath: string) {
  console.log('\n💰 ===== IMPORTING TRANSACTIONS (PAYS) =====\n');
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const worksheet = workbook.worksheets[0];
  const rows: any[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    rows.push({
      rowNumber,
      date: row.getCell(1).value?.toString() || '',
      category: row.getCell(2).value?.toString() || '',
      description: row.getCell(3).value?.toString() || '',
      amount: row.getCell(4).value?.toString() || '0',
      type: row.getCell(5).value?.toString() || 'INCOME',
      account: row.getCell(6).value?.toString() || 'حساب اصلی',
    });
  });

  let created = 0;
  let skipped = 0;
  const errors: any[] = [];

  // Get first admin user for createdBy
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!adminUser) {
    throw new Error('هیچ ADMIN در سیستم وجود ندارد');
  }

  for (const row of rows) {
    try {
      // Validate
      if (!row.date || !row.category || !row.amount) {
        throw new Error('فیلدهای الزامی خالی است');
      }

      // Parse date
      const transactionDate = jalaliToDate(row.date);
      if (!transactionDate) {
        throw new Error(`تاریخ نامعتبر: ${row.date}`);
      }

      // Find/create category
      const type = row.type.toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE';
      const categoryId = await findOrCreateCategory(row.category, type);

      // Find/create account
      const accountId = await findOrCreateAccount(row.account);

      // Parse amount
      const amount = tomanToRial(row.amount);

      // Create transaction
      await prisma.transaction.create({
        data: {
          type,
          amount: BigInt(amount),
          description: row.description || null,
          categoryId,
          accountId,
          sourceType: 'MANUAL',
          paymentMethod: 'CASH',
          occurredAt: transactionDate,
          createdBy: adminUser.id,
        },
      });

      created++;
      console.log(`✅ Row ${row.rowNumber}: Transaction created (${type})`);
    } catch (error: any) {
      skipped++;
      const errorMsg = `Row ${row.rowNumber}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  console.log(`\n📊 Transactions Summary:`);
  console.log(`   ✅ Created: ${created}`);
  console.log(`   ⚠️  Skipped: ${skipped}`);
  
  return { created, skipped, errors };
}

// Main function
async function main() {
  console.log('🚀 Starting Excel Import Process...\n');

  const appointmentsPath = join(__dirname, '../../../Appointments.xlsx');
  const paysPath = join(__dirname, '../../../Pays.xlsx');

  const results = {
    appointments: { created: 0, skipped: 0, errors: [] as string[] },
    transactions: { created: 0, skipped: 0, errors: [] as string[] },
  };

  try {
    // Import Appointments
    console.log(`📂 Reading: ${appointmentsPath}`);
    results.appointments = await importAppointments(appointmentsPath);

    // Import Transactions
    console.log(`📂 Reading: ${paysPath}`);
    results.transactions = await importTransactions(paysPath);

    // Generate report
    const report = `
════════════════════════════════════════════════════
📊 IMPORT REPORT
════════════════════════════════════════════════════

📅 APPOINTMENTS
   ✅ Created: ${results.appointments.created}
   ⚠️  Skipped: ${results.appointments.skipped}
   ${results.appointments.errors.length > 0 ? `\n   Errors:\n   ${results.appointments.errors.join('\n   ')}` : ''}

💰 TRANSACTIONS (PAYS)
   ✅ Created: ${results.transactions.created}
   ⚠️  Skipped: ${results.transactions.skipped}
   ${results.transactions.errors.length > 0 ? `\n   Errors:\n   ${results.transactions.errors.join('\n   ')}` : ''}

════════════════════════════════════════════════════
🎉 Import completed at: ${new Date().toLocaleString('fa-IR')}
════════════════════════════════════════════════════
`;

    console.log(report);

    // Save report
    const reportPath = join(__dirname, '../../../logs/import-report.txt');
    writeFileSync(reportPath, report, 'utf-8');
    console.log(`\n📄 Report saved: ${reportPath}`);

  } catch (error) {
    console.error('\n❌ Critical error during import:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run
main()
  .then(() => {
    console.log('\n✅ Import process completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import process failed:', error);
    process.exit(1);
  });

