/**
 * Database Restore Script
 * Restores database from JSON backup
 * 
 * USAGE:
 *   npx ts-node scripts/restore-database.ts <backup-file.json>
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// BigInt serialization fix
(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};

async function restoreDatabase(backupFilePath: string) {
  console.log('🔄 Starting database restore...');
  console.log(`📁 Backup file: ${backupFilePath}`);

  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found: ${backupFilePath}`);
  }

  try {
    // Read backup file
    const backupContent = fs.readFileSync(backupFilePath, 'utf8');
    const backup = JSON.parse(backupContent);

    console.log('📊 Backup metadata:', backup.metadata);
    console.log('📊 Stats:', backup.metadata.stats);

    // ⚠️ WARNING: This will DELETE all existing data!
    console.log('\n⚠️  WARNING: This will DELETE all existing data!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('🗑️  Clearing existing data...');

    // Delete in reverse order (respecting foreign keys)
    await prisma.notification.deleteMany();
    await prisma.pushSubscription.deleteMany();
    await prisma.blockedTime.deleteMany();
    await prisma.appointmentService.deleteMany();
    await prisma.appointment.deleteMany();
    await prisma.workSchedule.deleteMany();
    await prisma.employeeService.deleteMany();
    await prisma.service.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.homepageDetails.deleteMany();
    await prisma.calendarDate.deleteMany();

    console.log('✅ Existing data cleared');

    // Restore in correct order (respecting foreign keys)
    
    console.log('\n📥 Restoring data...');
    
    console.log('📊 Restoring users...');
    for (const user of backup.data.users) {
      await prisma.user.create({ data: user });
    }
    
    console.log('📊 Restoring employees...');
    for (const employee of backup.data.employees) {
      await prisma.employee.create({ data: employee });
    }
    
    console.log('📊 Restoring customers...');
    for (const customer of backup.data.customers) {
      await prisma.customer.create({ data: customer });
    }
    
    console.log('📊 Restoring services...');
    for (const service of backup.data.services) {
      await prisma.service.create({ data: service });
    }
    
    console.log('📊 Restoring employee services...');
    for (const es of backup.data.employeeServices) {
      await prisma.employeeService.create({ data: es });
    }
    
    console.log('📊 Restoring calendar dates...');
    // Batch insert for performance
    const batchSize = 1000;
    for (let i = 0; i < backup.data.calendarDates.length; i += batchSize) {
      const batch = backup.data.calendarDates.slice(i, i + batchSize);
      await prisma.calendarDate.createMany({ data: batch, skipDuplicates: true });
      console.log(`   ${i + batch.length} / ${backup.data.calendarDates.length}`);
    }
    
    console.log('📊 Restoring work schedules...');
    for (const ws of backup.data.workSchedules) {
      await prisma.workSchedule.create({ data: ws });
    }
    
    console.log('📊 Restoring appointments...');
    // Convert BigInt strings back to BigInt
    for (const apt of backup.data.appointments) {
      const data = { ...apt };
      if (data.amount) data.amount = BigInt(data.amount);
      if (data.tipAmount) data.tipAmount = BigInt(data.tipAmount);
      await prisma.appointment.create({ data });
    }
    
    console.log('📊 Restoring blocked times...');
    for (const bt of backup.data.blockedTimes) {
      await prisma.blockedTime.create({ data: bt });
    }
    
    console.log('📊 Restoring notifications...');
    for (const notif of backup.data.notifications) {
      await prisma.notification.create({ data: notif });
    }
    
    console.log('📊 Restoring push subscriptions...');
    for (const sub of backup.data.pushSubscriptions) {
      await prisma.pushSubscription.create({ data: sub });
    }
    
    console.log('📊 Restoring homepage details...');
    for (const hp of backup.data.homepageDetails) {
      await prisma.homepageDetails.create({ data: hp });
    }

    console.log('\n✅ Restore completed successfully!');
    console.log('📊 Restored:', backup.metadata.stats);

    return true;
  } catch (error) {
    console.error('❌ Restore failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get backup file from command line argument
const backupFile = process.argv[2];

if (!backupFile) {
  console.error('❌ Please provide backup file path');
  console.log('Usage: npx ts-node scripts/restore-database.ts <backup-file.json>');
  process.exit(1);
}

restoreDatabase(backupFile)
  .then(() => {
    console.log('\n🎊 Database restored successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

