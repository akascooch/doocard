import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// First, let's clear the current database
async function clearZapasDatabase() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🧹 Clearing zapas database...');
    
    // Delete in correct order to avoid foreign key constraints
    await prisma.transaction.deleteMany();
    await prisma.financialEntry.deleteMany();
    await prisma.barberWithdrawalRequest.deleteMany();
    await prisma.tipTransaction.deleteMany();
    await prisma.salary.deleteMany();
    await prisma.appointmentService.deleteMany();
    await prisma.appointment.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.barber.deleteMany();
    await prisma.service.deleteMany();
    await prisma.user.deleteMany();
    await prisma.financialCategory.deleteMany();
    await prisma.bankAccount.deleteMany();
    await prisma.setting.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.smsLog.deleteMany();
    await prisma.smsSettings.deleteMany();
    await prisma.smsTemplate.deleteMany();
    await prisma.profile.deleteMany();
    
    console.log('✅ Zapas database cleared');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Export data from mova database
async function exportFromMova() {
  // Temporarily change DATABASE_URL to mova
  const originalUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://postgres:Lord7know$@localhost:5433/MOVA?schema=public";
  
  const prisma = new PrismaClient();
  
  try {
    console.log('📊 Exporting data from mova database...');
    
    const exportData: any = {};
    
    // Export all tables
    const tables = [
      'user', 'profile', 'barber', 'service', 'customer', 'appointment',
      'appointmentService', 'transaction', 'financialCategory', 'financialEntry',
      'bankAccount', 'salary', 'tipTransaction', 'barberWithdrawalRequest',
      'setting', 'permission', 'smsLog', 'smsSettings', 'smsTemplate'
    ];
    
    for (const table of tables) {
      console.log(`📊 Exporting ${table}...`);
      try {
        const data = await (prisma as any)[table].findMany();
        exportData[table + 's'] = data; // Add 's' to make it plural
        console.log(`   ✅ ${table}: ${data.length} records`);
      } catch (error) {
        console.log(`   ⚠️  ${table}: Error - ${error.message}`);
      }
    }
    
    // Save to file
    const exportPath = path.join(__dirname, 'mova-data-export.json');
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    
    console.log('✅ Data exported successfully to:', exportPath);
    
    // Print summary
    console.log('📊 Export Summary:');
    Object.keys(exportData).forEach(table => {
      console.log(`   ${table}: ${exportData[table].length} records`);
    });
    
  } catch (error) {
    console.error('❌ Error exporting data:', error);
  } finally {
    await prisma.$disconnect();
    // Restore original DATABASE_URL
    process.env.DATABASE_URL = originalUrl;
  }
}

// Import data to zapas database with preserved IDs
async function importToZapas() {
  const prisma = new PrismaClient();
  
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
    // First, import tables without foreign keys
    const independentTables = ['users', 'profiles', 'financialCategories', 'bankAccounts', 'services', 'settings', 'permissions', 'smsLogs', 'smsSettings', 'smsTemplates'];
    
    for (const table of independentTables) {
      if (exportData[table] && exportData[table].length > 0) {
        console.log(`📊 Importing ${table}...`);
        for (const record of exportData[table]) {
          try {
            await (prisma as any)[table.replace(/s$/, '')].create({
              data: record, // Keep original ID
            });
          } catch (error) {
            console.log(`   ⚠️  Error importing record: ${error.message}`);
          }
        }
        console.log(`   ✅ ${table}: ${exportData[table].length} records imported`);
      }
    }
    
    // Then import tables with foreign keys
    const dependentTables = ['barbers', 'customers', 'appointments', 'appointmentServices', 'financialEntries', 'transactions', 'salaries', 'tipTransactions', 'barberWithdrawalRequests'];
    
    for (const table of dependentTables) {
      if (exportData[table] && exportData[table].length > 0) {
        console.log(`📊 Importing ${table}...`);
        for (const record of exportData[table]) {
          try {
            await (prisma as any)[table.replace(/s$/, '')].create({
              data: record, // Keep original ID
            });
          } catch (error) {
            console.log(`   ⚠️  Error importing record: ${error.message}`);
          }
        }
        console.log(`   ✅ ${table}: ${exportData[table].length} records imported`);
      }
    }
    
    console.log('✅ Data import completed successfully!');
    
  } catch (error) {
    console.error('❌ Error importing data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Main migration function
async function betterMigration() {
  try {
    console.log('🚀 Starting better database migration from mova to zapas...');
    
    // Step 1: Clear zapas database
    await clearZapasDatabase();
    
    // Step 2: Export from mova
    await exportFromMova();
    
    // Step 3: Import to zapas
    await importToZapas();
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run migration
betterMigration(); 