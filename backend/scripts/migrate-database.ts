import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateDatabase() {
  try {
    console.log('🔍 Starting database migration from mova to zapas...');
    
    // Step 1: Clear current database (zapas)
    console.log('🧹 Clearing current database...');
    
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
    
    console.log('✅ Current database cleared');
    
    // Step 2: Connect to mova database and export data
    console.log('📊 Connecting to mova database...');
    
    // We need to temporarily change the DATABASE_URL to point to mova
    // For now, let's create a script that can be run with the correct DATABASE_URL
    
    console.log('⚠️  Please run the following commands:');
    console.log('');
    console.log('1. Set DATABASE_URL to mova:');
    console.log('   set DATABASE_URL="postgresql://postgres:Lord7know$@localhost:5433/MOVA?schema=public"');
    console.log('');
    console.log('2. Run export script:');
    console.log('   npx ts-node scripts/export-mova-data.ts');
    console.log('');
    console.log('3. Set DATABASE_URL back to zapas:');
    console.log('   set DATABASE_URL="postgresql://postgres:Lord7know$@localhost:5433/zapas?schema=public"');
    console.log('');
    console.log('4. Run import script:');
    console.log('   npx ts-node scripts/import-mova-data.ts');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateDatabase(); 