import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  try {
    // Read the SQL file
    const sqlFile = path.join(__dirname, 'test-customers.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Execute the SQL using Prisma
    await prisma.$executeRawUnsafe(sql);

    console.log('✅ تست دیتای مشتریان با موفقیت اضافه شد');
  } catch (error) {
    console.error('❌ خطا در اضافه کردن تست دیتا:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  }); 