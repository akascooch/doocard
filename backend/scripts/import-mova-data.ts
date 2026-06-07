import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function importMovaData() {
  try {
    console.log('🔍 Importing data to zapas database...');
    
    // Read export file
    const exportPath = path.join(__dirname, 'mova-data-export.json');
    if (!fs.existsSync(exportPath)) {
      console.error('❌ Export file not found:', exportPath);
      return;
    }
    
    const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    console.log('✅ Export file loaded');
    
    // Import in correct order to avoid foreign key constraints
    console.log('📊 Importing users...');
    for (const user of exportData.users || []) {
      await prisma.user.create({
        data: {
          ...user,
          id: undefined, // Let Prisma generate new ID
        },
      });
    }
    
    console.log('📊 Importing profiles...');
    for (const profile of exportData.profiles || []) {
      await prisma.profile.create({
        data: {
          ...profile,
          id: undefined,
        },
      });
    }
    
    console.log('📊 Importing financial categories...');
    for (const category of exportData.financialCategories || []) {
      await prisma.financialCategory.create({
        data: {
          ...category,
          id: undefined,
        },
      });
    }
    
    console.log('📊 Importing bank accounts...');
    for (const account of exportData.bankAccounts || []) {
      await prisma.bankAccount.create({
        data: {
          ...account,
          id: undefined,
        },
      });
    }
    
    console.log('📊 Importing services...');
    for (const service of exportData.services || []) {
      await prisma.service.create({
        data: {
          ...service,
          id: undefined,
        },
      });
    }
    
    console.log('📊 Importing barbers...');
    for (const barber of exportData.barbers || []) {
      await prisma.barber.create({
        data: {
          ...barber,
          id: undefined,
        },
      });
    }
    
    console.log('📊 Importing customers...');
    for (const customer of exportData.customers || []) {
      await prisma.customer.create({
        data: {
          ...customer,
          id: undefined,
        },
      });
    }
    
    console.log('📊 Importing appointments...');
    for (const appointment of exportData.appointments || []) {
      await prisma.appointment.create({
        data: {
          ...appointment,
          id: undefined,
        },
      });
    }
    
    console.log('📊 Importing appointment services...');
    for (const appointmentService of exportData.appointmentServices || []) {
      await prisma.appointmentService.create({
        data: {
          ...appointmentService,
          id: undefined,
        },
      });
    }
    
    console.log('📊 Importing financial entries...');
    for (const entry of exportData.financialEntries || []) {
      await prisma.financialEntry.create({
        data: {
          ...entry,
          id: undefined,
        },
      });
    }
    
    console.log('📊 Importing transactions...');
    for (const transaction of exportData.transactions || []) {
      await prisma.transaction.create({
        data: {
          ...transaction,
          id: undefined,
        },
      });
    }
    
    console.log('📊 Importing salaries...');
    for (const salary of exportData.salaries || []) {
      await prisma.salary.create({
        data: {
          ...salary,
          id: undefined,
        },
      });
    }
    
    console.log('📊 Importing tip transactions...');
    for (const tipTransaction of exportData.tipTransactions || []) {
      await prisma.tipTransaction.create({
        data: {
          ...tipTransaction,
          id: undefined,
        },
      });
    }
    
    console.log('📊 Importing barber withdrawal requests...');
    for (const withdrawal of exportData.barberWithdrawalRequests || []) {
      await prisma.barberWithdrawalRequest.create({
        data: {
          ...withdrawal,
          id: undefined,
        },
      });
    }
    
    console.log('📊 Importing settings...');
    for (const setting of exportData.settings || []) {
      await prisma.setting.create({
        data: {
          ...setting,
          id: undefined,
        },
      });
    }
    
    console.log('📊 Importing permissions...');
    for (const permission of exportData.permissions || []) {
      await prisma.permission.create({
        data: {
          ...permission,
          id: undefined,
        },
      });
    }
    
    console.log('📊 Importing SMS logs...');
    for (const smsLog of exportData.smsLogs || []) {
      await prisma.smsLog.create({
        data: {
          ...smsLog,
          id: undefined,
        },
      });
    }
    
    console.log('📊 Importing SMS settings...');
    for (const smsSetting of exportData.smsSettings || []) {
      await prisma.smsSettings.create({
        data: {
          ...smsSetting,
          id: undefined,
        },
      });
    }
    
    console.log('📊 Importing SMS templates...');
    for (const smsTemplate of exportData.smsTemplates || []) {
      await prisma.smsTemplate.create({
        data: {
          ...smsTemplate,
          id: undefined,
        },
      });
    }
    
    console.log('✅ Data import completed successfully!');
    
    // Print summary
    console.log('📊 Import Summary:');
    Object.keys(exportData).forEach(table => {
      console.log(`   ${table}: ${exportData[table].length} records imported`);
    });
    
  } catch (error) {
    console.error('❌ Error importing data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importMovaData(); 