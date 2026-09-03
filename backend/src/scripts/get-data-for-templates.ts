import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📊 Fetching data for Excel templates...\n');

  // Get employees
  const employees = await prisma.employee.findMany({
    include: { user: true },
    take: 10,
  });

  console.log('👥 EMPLOYEES:');
  employees.forEach(emp => {
    console.log(`   ID: ${emp.id} | Name: ${emp.user.name} | Phone: ${emp.user.phone}`);
  });

  // Get services
  const services = await prisma.service.findMany({
    take: 10,
  });

  console.log('\n✂️ SERVICES:');
  services.forEach(svc => {
    console.log(`   ID: ${svc.id} | Name: ${svc.name} | Price: ${Math.floor(Number(svc.price) / 10)} تومان | Duration: ${svc.durationMinutes} دقیقه`);
  });

  // Get customers (sample)
  const customers = await prisma.customer.findMany({
    include: { user: true },
    take: 5,
  });

  console.log('\n👤 CUSTOMERS (Sample):');
  customers.forEach(cust => {
    console.log(`   ID: ${cust.id} | Name: ${cust.user.name} | Phone: ${cust.user.phone}`);
  });

  // Get categories
  const categories = await prisma.transactionCategory.findMany({
    take: 10,
  });

  console.log('\n📁 CATEGORIES:');
  categories.forEach(cat => {
    console.log(`   ID: ${cat.id} | Name: ${cat.name} | Type: ${cat.type}`);
  });

  // Get accounts
  const accounts = await prisma.bankAccount.findMany({
    take: 5,
  });

  console.log('\n🏦 BANK ACCOUNTS:');
  accounts.forEach(acc => {
    console.log(`   ID: ${acc.id} | Name: ${acc.name} | Balance: ${Math.floor(Number(acc.balance) / 10)} تومان`);
  });

  await prisma.$disconnect();
}

main();

