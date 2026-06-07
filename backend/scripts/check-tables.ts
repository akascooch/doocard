import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTables() {
  try {
    console.log('🔍 Checking database tables...');
    
    // Check if we can connect to the database
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Try to get table information
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    console.log('📋 Available tables:');
    console.log(tables);
    
    // Try to count records in each table
    console.log('\n📊 Table record counts:');
    
    try {
      const userCount = await prisma.user.count();
      console.log(`Users: ${userCount}`);
    } catch (e) {
      console.log(`❌ Error counting users: ${e.message}`);
    }
    
    try {
      const customerCount = await prisma.customer.count();
      console.log(`Customers: ${customerCount}`);
    } catch (e) {
      console.log(`❌ Error counting customers: ${e.message}`);
    }
    
    try {
      const barberCount = await prisma.barber.count();
      console.log(`Barbers: ${barberCount}`);
    } catch (e) {
      console.log(`❌ Error counting barbers: ${e.message}`);
    }
    
    try {
      const serviceCount = await prisma.service.count();
      console.log(`Services: ${serviceCount}`);
    } catch (e) {
      console.log(`❌ Error counting services: ${e.message}`);
    }
    
    try {
      const appointmentCount = await prisma.appointment.count();
      console.log(`Appointments: ${appointmentCount}`);
    } catch (e) {
      console.log(`❌ Error counting appointments: ${e.message}`);
    }
    
    try {
      const transactionCount = await prisma.transaction.count();
      console.log(`Transactions: ${transactionCount}`);
    } catch (e) {
      console.log(`❌ Error counting transactions: ${e.message}`);
    }
    
    try {
      const financialEntryCount = await prisma.financialEntry.count();
      console.log(`Financial Entries: ${financialEntryCount}`);
    } catch (e) {
      console.log(`❌ Error counting financial entries: ${e.message}`);
    }
    
    try {
      const financialCategoryCount = await prisma.financialCategory.count();
      console.log(`Financial Categories: ${financialCategoryCount}`);
    } catch (e) {
      console.log(`❌ Error counting financial categories: ${e.message}`);
    }
    
    try {
      const salaryCount = await prisma.salary.count();
      console.log(`Salaries: ${salaryCount}`);
    } catch (e) {
      console.log(`❌ Error counting salaries: ${e.message}`);
    }
    
    try {
      const profileCount = await prisma.profile.count();
      console.log(`Profiles: ${profileCount}`);
    } catch (e) {
      console.log(`❌ Error counting profiles: ${e.message}`);
    }
    
    try {
      const smsLogCount = await prisma.smsLog.count();
      console.log(`SMS Logs: ${smsLogCount}`);
    } catch (e) {
      console.log(`❌ Error counting SMS logs: ${e.message}`);
    }
    
    try {
      const smsTemplateCount = await prisma.smsTemplate.count();
      console.log(`SMS Templates: ${smsTemplateCount}`);
    } catch (e) {
      console.log(`❌ Error counting SMS templates: ${e.message}`);
    }
    
    try {
      const smsSettingsCount = await prisma.smsSettings.count();
      console.log(`SMS Settings: ${smsSettingsCount}`);
    } catch (e) {
      console.log(`❌ Error counting SMS settings: ${e.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();
