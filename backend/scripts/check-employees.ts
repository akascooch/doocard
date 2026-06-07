import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEmployees() {
  const employees = await prisma.employee.findMany({
    include: { user: true },
  });

  console.log('👥 Employees in Database:\n');
  employees.forEach(emp => {
    console.log(`ID: ${emp.id} | UserID: ${emp.userId} | Name: ${emp.user.name}`);
  });

  console.log(`\n📊 Total Employees: ${employees.length}`);
  
  await prisma.$disconnect();
}

checkEmployees();

