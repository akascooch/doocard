import * as ExcelJS from 'exceljs';
import { join } from 'path';

async function generateAppointmentsExcel() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('نوبت‌ها');

  // Define columns
  worksheet.columns = [
    { header: 'نام مشتری', key: 'customerName', width: 20 },
    { header: 'نام کارمند', key: 'employeeName', width: 20 },
    { header: 'خدمات (با کاما)', key: 'services', width: 30 },
    { header: 'تاریخ (شمسی)', key: 'date', width: 15 },
    { header: 'ساعت', key: 'time', width: 10 },
    { header: 'وضعیت', key: 'status', width: 15 },
    { header: 'روش پرداخت', key: 'paymentMethod', width: 15 },
    { header: 'مبلغ (تومان)', key: 'amount', width: 15 },
    { header: 'انعام (تومان)', key: 'tip', width: 15 },
  ];

  // Sample data rows (based on actual database)
  const sampleRows = [
    {
      customerName: 'Amir mova',
      employeeName: 'Ario',
      services: 'اصلاح مو, اصلاح ریش',
      date: '1404/07/23',
      time: '10:00',
      status: 'PENDING',
      paymentMethod: 'CASH',
      amount: '280,000',
      tip: '20,000',
    },
    {
      customerName: 'Mohammad moeini',
      employeeName: 'Majid Mahbub',
      services: 'رنگ مو',
      date: '1404/07/24',
      time: '14:30',
      status: 'CONFIRMED',
      paymentMethod: 'CARD',
      amount: '600,000',
      tip: '50,000',
    },
    {
      customerName: 'Tommy',
      employeeName: 'Ashkan ashtish',
      services: 'خدمات داماد',
      date: '1404/07/25',
      time: '16:00',
      status: 'PENDING',
      paymentMethod: 'CARD2CARD',
      amount: '750,000',
      tip: '100,000',
    },
    {
      customerName: 'Sahar maboudian',
      employeeName: 'Arash',
      services: 'مراقبت و پاکسازی تخصصی پوست صورت, خدمات ناخن',
      date: '1404/07/26',
      time: '11:00',
      status: 'SETTLED',
      paymentMethod: 'CASH',
      amount: '500,000',
      tip: '30,000',
    },
    {
      customerName: 'علی محمدی',
      employeeName: 'Tommy',
      services: 'اصلاح مو, استایل مو',
      date: '1404/07/27',
      time: '09:30',
      status: 'PENDING',
      paymentMethod: 'CASH',
      amount: '240,000',
      tip: '10,000',
    },
  ];

  sampleRows.forEach(row => worksheet.addRow(row));

  // Style header
  worksheet.getRow(1).font = { bold: true, size: 12 };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFA1D1B1' },
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'right' };

  // Style data rows
  worksheet.eachRow((row, rowNum) => {
    if (rowNum > 1) {
      row.alignment = { horizontal: 'right' };
    }
  });

  // Save file
  const filePath = join(__dirname, '../../../Appointments.xlsx');
  await workbook.xlsx.writeFile(filePath);
  console.log(`✅ Created: ${filePath}`);
}

async function generatePaysExcel() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('تراکنش‌ها');

  // Define columns
  worksheet.columns = [
    { header: 'تاریخ (شمسی)', key: 'date', width: 15 },
    { header: 'دسته‌بندی', key: 'category', width: 25 },
    { header: 'توضیحات', key: 'description', width: 35 },
    { header: 'مبلغ (تومان)', key: 'amount', width: 15 },
    { header: 'نوع (INCOME/EXPENSE)', key: 'type', width: 20 },
    { header: 'حساب بانکی', key: 'account', width: 20 },
  ];

  // Sample data rows (based on actual database)
  const sampleRows = [
    {
      date: '1404/07/20',
      category: 'درآمد نوبت‌دهی',
      description: 'درآمد نوبت مشتری علی احمدی',
      amount: '280,000',
      type: 'INCOME',
      account: 'حساب اصلی سالن',
    },
    {
      date: '1404/07/21',
      category: 'فروش محصولات',
      description: 'فروش محصولات مو',
      amount: '150,000',
      type: 'INCOME',
      account: 'حساب اصلی سالن',
    },
    {
      date: '1404/07/22',
      category: 'حقوق و دستمزد',
      description: 'حقوق آقای اریو - ماه مهر',
      amount: '12,000,000',
      type: 'EXPENSE',
      account: 'حساب اصلی سالن',
    },
    {
      date: '1404/07/22',
      category: 'خرید مواد اولیه',
      description: 'خرید شامپو و رنگ مو',
      amount: '500,000',
      type: 'EXPENSE',
      account: 'بانک سامان',
    },
    {
      date: '1404/07/23',
      category: 'اجاره و آب و برق',
      description: 'قبض برق ماه مهر',
      amount: '850,000',
      type: 'EXPENSE',
      account: 'حساب اصلی سالن',
    },
    {
      date: '1404/07/23',
      category: 'انعام',
      description: 'انعام آقای مجید - خدمت عالی',
      amount: '50,000',
      type: 'INCOME',
      account: 'حساب اصلی سالن',
    },
    {
      date: '1404/07/24',
      category: 'درآمد خدمات',
      description: 'درآمد خدمات داماد',
      amount: '750,000',
      type: 'INCOME',
      account: 'حساب اصلی سالن',
    },
    {
      date: '1404/07/24',
      category: 'تعمیر و نگهداری',
      description: 'تعمیر صندلی آرایشگاه',
      amount: '300,000',
      type: 'EXPENSE',
      account: 'حساب اصلی سالن',
    },
  ];

  sampleRows.forEach(row => worksheet.addRow(row));

  // Style header
  worksheet.getRow(1).font = { bold: true, size: 12 };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFA1D1B1' },
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'right' };

  // Style data rows
  worksheet.eachRow((row, rowNum) => {
    if (rowNum > 1) {
      row.alignment = { horizontal: 'right' };
    }
  });

  // Save file
  const filePath = join(__dirname, '../../../Pays.xlsx');
  await workbook.xlsx.writeFile(filePath);
  console.log(`✅ Created: ${filePath}`);
}

async function main() {
  console.log('📝 Generating sample Excel files...\n');
  
  await generateAppointmentsExcel();
  await generatePaysExcel();
  
  console.log('\n🎉 Sample Excel files created successfully!');
  console.log('\nFiles location:');
  console.log('   📅 Appointments.xlsx');
  console.log('   💰 Pays.xlsx');
  console.log('\nYou can now edit these files and run the import script!');
}

main();

