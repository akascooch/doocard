import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function deleteAllAppointments() {
  try {
    console.log('🔍 Checking appointments...\n');

    // 1. Count total appointments
    const totalCount = await prisma.appointment.count();
    console.log(`📊 Total appointments in database: ${totalCount}\n`);

    if (totalCount === 0) {
      console.log('✅ No appointments to delete.');
      return;
    }

    // 2. Create backup before deletion
    console.log('💾 Creating backup...');
    const allAppointments = await prisma.appointment.findMany({
      include: {
        customer: true,
        employee: true,
      },
    });

    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(
      backupDir,
      `appointments-backup-${timestamp}.json`,
    );

    // Convert BigInt to string for JSON serialization
    const bigIntReplacer = (key: string, value: any) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    };

    fs.writeFileSync(
      backupFile,
      JSON.stringify(allAppointments, bigIntReplacer, 2),
    );
    console.log(`✅ Backup saved: ${backupFile}\n`);

    // 3. Delete all appointments
    console.log('🗑️  Deleting all appointments...');
    const deleteResult = await prisma.appointment.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.count} appointments\n`);

    // 4. Verify deletion
    const remainingCount = await prisma.appointment.count();
    console.log(`📊 Remaining appointments: ${remainingCount}\n`);

    if (remainingCount === 0) {
      console.log('✅ All appointments successfully deleted!');
      console.log('📁 Backup location:', backupFile);
      console.log('\n🎯 Ready for Excel import!');
    } else {
      console.log('⚠️  Warning: Some appointments still remain in database');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
deleteAllAppointments()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

