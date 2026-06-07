import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

/**
 * Reset Database Script
 * 
 * This script safely deletes all records from every table while maintaining
 * referential integrity by deleting child entities before parent entities.
 * 
 * Deletion order (child -> parent):
 * 1. Junction tables and dependent records first
 * 2. Main entity records
 * 3. User records last (as they're referenced by many tables)
 */

async function resetDatabase(confirmReset: boolean = false, dryRun: boolean = false) {
  console.log('🔄 Starting database reset...');
  
  // Safety check - require explicit confirmation
  if (!confirmReset) {
    console.log('⚠️  WARNING: This will delete ALL data from the database!');
    console.log('   To proceed, call: resetDatabase(true)');
    console.log('   Or run: npm run db:reset -- --confirm');
    console.log('   For dry run: npm run db:reset -- --dry-run');
    return;
  }
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No data will be deleted');
  }
  
  try {
    // Start a transaction to ensure all operations succeed or fail together
    await prisma.$transaction(async (tx) => {
      console.log('📊 Deleting junction tables and dependent records...');
      
      // 1. Delete junction tables and dependent records first
      if (dryRun) {
        const appointmentServiceCount = await tx.appointmentService.count();
        console.log(`   🔍 Would delete ${appointmentServiceCount} appointment services`);
        
        const employeeServiceCount = await tx.employeeService.count();
        console.log(`   🔍 Would delete ${employeeServiceCount} employee services`);
        
        // 2. Delete dependent records that reference main entities
        const tipCount = await tx.tip.count();
        console.log(`   🔍 Would delete ${tipCount} tips`);
        
        const salaryCount = await tx.salary.count();
        console.log(`   🔍 Would delete ${salaryCount} salaries`);
        
        const transactionCount = await tx.transaction.count();
        console.log(`   🔍 Would delete ${transactionCount} transactions`);
        
        const smsLogCount = await tx.smsLog.count();
        console.log(`   🔍 Would delete ${smsLogCount} SMS logs`);
        
        const permissionCount = await tx.permission.count();
        console.log(`   🔍 Would delete ${permissionCount} permissions`);
        
        const dayClosingCount = await tx.dayClosing.count();
        console.log(`   🔍 Would delete ${dayClosingCount} day closings`);
      } else {
        const appointmentServiceCount = await tx.appointmentService.deleteMany();
        console.log(`   ✅ Deleted ${appointmentServiceCount.count} appointment services`);
        
        const employeeServiceCount = await tx.employeeService.deleteMany();
        console.log(`   ✅ Deleted ${employeeServiceCount.count} employee services`);
        
        // 2. Delete dependent records that reference main entities
        const tipCount = await tx.tip.deleteMany();
        console.log(`   ✅ Deleted ${tipCount.count} tips`);
        
        const salaryCount = await tx.salary.deleteMany();
        console.log(`   ✅ Deleted ${salaryCount.count} salaries`);
        
        const transactionCount = await tx.transaction.deleteMany();
        console.log(`   ✅ Deleted ${transactionCount.count} transactions`);
        
        const smsLogCount = await tx.smsLog.deleteMany();
        console.log(`   ✅ Deleted ${smsLogCount.count} SMS logs`);
        
        const permissionCount = await tx.permission.deleteMany();
        console.log(`   ✅ Deleted ${permissionCount.count} permissions`);
        
        const dayClosingCount = await tx.dayClosing.deleteMany();
        console.log(`   ✅ Deleted ${dayClosingCount.count} day closings`);
      }
      
      console.log('📋 Deleting main entity records...');
      
      // 3. Delete main entity records
      if (dryRun) {
        const appointmentCount = await tx.appointment.count();
        console.log(`   🔍 Would delete ${appointmentCount} appointments`);
        
        const customerCount = await tx.customer.count();
        console.log(`   🔍 Would delete ${customerCount} customers`);
        
        const employeeCount = await tx.employee.count();
        console.log(`   🔍 Would delete ${employeeCount} employees`);
        
        const serviceCount = await tx.service.count();
        console.log(`   🔍 Would delete ${serviceCount} services`);
        
        const categoryCount = await tx.category.count();
        console.log(`   🔍 Would delete ${categoryCount} categories`);
        
        const smsSettingsCount = await tx.smsSettings.count();
        console.log(`   🔍 Would delete ${smsSettingsCount} SMS settings`);
        
        const smsTemplateCount = await tx.smsTemplate.count();
        console.log(`   🔍 Would delete ${smsTemplateCount} SMS templates`);
        
        const homepageDetailsCount = await tx.homepageDetails.count();
        console.log(`   🔍 Would delete ${homepageDetailsCount} homepage details`);
        
        console.log('👥 Deleting user records...');
        
        // 4. Delete users last (as they're referenced by many tables)
        const userCount = await tx.user.count();
        console.log(`   🔍 Would delete ${userCount} users`);
      } else {
        const appointmentCount = await tx.appointment.deleteMany();
        console.log(`   ✅ Deleted ${appointmentCount.count} appointments`);
        
        const customerCount = await tx.customer.deleteMany();
        console.log(`   ✅ Deleted ${customerCount.count} customers`);
        
        const employeeCount = await tx.employee.deleteMany();
        console.log(`   ✅ Deleted ${employeeCount.count} employees`);
        
        const serviceCount = await tx.service.deleteMany();
        console.log(`   ✅ Deleted ${serviceCount.count} services`);
        
        const categoryCount = await tx.category.deleteMany();
        console.log(`   ✅ Deleted ${categoryCount.count} categories`);
        
        const smsSettingsCount = await tx.smsSettings.deleteMany();
        console.log(`   ✅ Deleted ${smsSettingsCount.count} SMS settings`);
        
        const smsTemplateCount = await tx.smsTemplate.deleteMany();
        console.log(`   ✅ Deleted ${smsTemplateCount.count} SMS templates`);
        
        const homepageDetailsCount = await tx.homepageDetails.deleteMany();
        console.log(`   ✅ Deleted ${homepageDetailsCount.count} homepage details`);
        
        console.log('👥 Deleting user records...');
        
        // 4. Delete users last (as they're referenced by many tables)
        const userCount = await tx.user.deleteMany();
        console.log(`   ✅ Deleted ${userCount.count} users`);
      }
      
      console.log('🎉 Database reset completed successfully!');
    });
    
  } catch (error) {
    console.error('❌ Error during database reset:', error);
    throw error;
  } finally {
    // Always disconnect Prisma client
    await prisma.$disconnect();
    console.log('🔌 Database connection closed');
  }
}

// Export the function for use in package.json
export { resetDatabase };

// If this script is run directly (not imported), execute the reset
if (require.main === module) {
  // Check for flags
  const confirmFlag = process.argv.includes('--confirm');
  const dryRunFlag = process.argv.includes('--dry-run');
  
  // If dry-run is specified, automatically confirm it
  const shouldConfirm = confirmFlag || dryRunFlag;
  
  resetDatabase(shouldConfirm, dryRunFlag)
    .then(() => {
      console.log('✅ Database reset script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database reset script failed:', error);
      process.exit(1);
    });
}
