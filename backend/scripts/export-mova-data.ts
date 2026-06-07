import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function exportMovaData() {
  try {
    console.log('🔍 Exporting data from mova database...');
    
    const exportData: any = {};
    
    // Export all tables
    console.log('📊 Exporting users...');
    exportData.users = await prisma.user.findMany();
    
    console.log('📊 Exporting profiles...');
    exportData.profiles = await prisma.profile.findMany();
    
    console.log('📊 Exporting barbers...');
    exportData.barbers = await prisma.barber.findMany();
    
    console.log('📊 Exporting services...');
    exportData.services = await prisma.service.findMany();
    
    console.log('📊 Exporting customers...');
    exportData.customers = await prisma.customer.findMany();
    
    console.log('📊 Exporting appointments...');
    exportData.appointments = await prisma.appointment.findMany();
    
    console.log('📊 Exporting appointment services...');
    exportData.appointmentServices = await prisma.appointmentService.findMany();
    
    console.log('📊 Exporting transactions...');
    exportData.transactions = await prisma.transaction.findMany();
    
    console.log('📊 Exporting financial categories...');
    exportData.financialCategories = await prisma.financialCategory.findMany();
    
    console.log('📊 Exporting financial entries...');
    exportData.financialEntries = await prisma.financialEntry.findMany();
    
    console.log('📊 Exporting bank accounts...');
    exportData.bankAccounts = await prisma.bankAccount.findMany();
    
    console.log('📊 Exporting salaries...');
    exportData.salaries = await prisma.salary.findMany();
    
    console.log('📊 Exporting tip transactions...');
    exportData.tipTransactions = await prisma.tipTransaction.findMany();
    
    console.log('📊 Exporting barber withdrawal requests...');
    exportData.barberWithdrawalRequests = await prisma.barberWithdrawalRequest.findMany();
    
    console.log('📊 Exporting settings...');
    exportData.settings = await prisma.setting.findMany();
    
    console.log('📊 Exporting permissions...');
    exportData.permissions = await prisma.permission.findMany();
    
    console.log('📊 Exporting SMS logs...');
    exportData.smsLogs = await prisma.smsLog.findMany();
    
    console.log('📊 Exporting SMS settings...');
    exportData.smsSettings = await prisma.smsSettings.findMany();
    
    console.log('📊 Exporting SMS templates...');
    exportData.smsTemplates = await prisma.smsTemplate.findMany();
    
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
  }
}

exportMovaData(); 