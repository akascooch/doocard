import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

async function checkCustomerIds() {
  // Read Excel
  const workbook = XLSX.readFile('C:\\Users\\a.hosseini\\Desktop\\Data\\DATA1-7.xlsx');
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  const customerIdsInExcel = [...new Set(data.map((row: any) => row.CustomerId))];
  console.log(`📊 Unique Customer IDs in Excel: ${customerIdsInExcel.length}`);
  console.log(`   IDs: ${customerIdsInExcel.sort((a, b) => a - b).join(', ')}\n`);
  
  // Check database
  const customersInDb = await prisma.customer.findMany({
    select: { id: true },
  });
  
  const customerIdsInDb = customersInDb.map(c => c.id);
  console.log(`📊 Customer IDs in Database: ${customerIdsInDb.length}`);
  console.log(`   IDs: ${customerIdsInDb.sort((a, b) => a - b).join(', ')}\n`);
  
  // Find missing
  const missing = customerIdsInExcel.filter((id: number) => !customerIdsInDb.includes(id));
  console.log(`❌ Missing Customer IDs: ${missing.length}`);
  if (missing.length > 0) {
    console.log(`   IDs: ${missing.join(', ')}`);
  }
  
  await prisma.$disconnect();
}

checkCustomerIds();

