/**
 * Complete Database Backup Script
 * Exports all data to JSON + SQL dump
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// BigInt serialization fix
(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                    new Date().toTimeString().split(' ')[0].replace(/:/g, '');
  
  const backupDir = path.join(__dirname, '../../backup');
  
  // Create backup directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, `doocard_backup_${timestamp}.json`);

  console.log('🗄️  Starting database backup...');
  console.log(`📁 Backup file: ${backupFile}`);

  try {
    const backup: any = {
      metadata: {
        version: '1.2.4',
        timestamp: new Date().toISOString(),
        database: 'MOVA',
        description: 'Complete Doocard database backup with all data',
      },
      data: {},
    };

    // Backup all tables in order (respecting foreign keys)
    console.log('📊 Exporting users...');
    backup.data.users = await prisma.user.findMany();
    
    console.log('📊 Exporting customers...');
    backup.data.customers = await prisma.customer.findMany();
    
    console.log('📊 Exporting employees...');
    backup.data.employees = await prisma.employee.findMany();
    
    console.log('📊 Exporting services...');
    backup.data.services = await prisma.service.findMany();
    
    console.log('📊 Exporting employee services...');
    backup.data.employeeServices = await prisma.employeeService.findMany();
    
    console.log('📊 Exporting calendar dates...');
    backup.data.calendarDates = await prisma.calendarDate.findMany();
    
    console.log('📊 Exporting work schedules...');
    backup.data.workSchedules = await prisma.workSchedule.findMany();
    
    console.log('📊 Exporting appointments...');
    backup.data.appointments = await prisma.appointment.findMany();
    
    console.log('📊 Exporting blocked times...');
    backup.data.blockedTimes = await prisma.blockedTime.findMany();
    
    console.log('📊 Exporting notifications...');
    backup.data.notifications = await prisma.notification.findMany();
    
    console.log('📊 Exporting push subscriptions...');
    backup.data.pushSubscriptions = await prisma.pushSubscription.findMany();
    
    console.log('📊 Exporting homepage details...');
    backup.data.homepageDetails = await prisma.homepageDetails.findMany();

    // Calculate stats
    const stats = {
      users: backup.data.users?.length || 0,
      customers: backup.data.customers?.length || 0,
      employees: backup.data.employees?.length || 0,
      services: backup.data.services?.length || 0,
      appointments: backup.data.appointments?.length || 0,
      notifications: backup.data.notifications?.length || 0,
      calendarDates: backup.data.calendarDates?.length || 0,
      workSchedules: backup.data.workSchedules?.length || 0,
      blockedTimes: backup.data.blockedTimes?.length || 0,
    };

    backup.metadata.stats = stats;

    // Write to file
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8');

    console.log('\n✅ Backup completed successfully!');
    console.log(`📁 File: ${backupFile}`);
    console.log(`📊 Stats:`, stats);
    console.log(`💾 Size: ${(fs.statSync(backupFile).size / 1024 / 1024).toFixed(2)} MB`);

    return backupFile;
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

backupDatabase()
  .then((file) => {
    console.log('\n🎊 Backup ready for server deployment!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

