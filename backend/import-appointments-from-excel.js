const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const jalaali = require('jalaali-js');

const prisma = new PrismaClient();

// تبدیل Jalali به Gregorian
function jalaliToGregorian(jalaliStr) {
  try {
    // اگر قبلاً ISO است، برگردان
    if (jalaliStr.includes('T') || jalaliStr.includes('-')) {
      return jalaliStr;
    }
    
    const parts = jalaliStr.split('/');
    if (parts.length !== 3) {
      throw new Error('Invalid Jalali date format. Expected: YYYY/MM/DD');
    }
    
    const [jy, jm, jd] = parts.map(Number);
    const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
    
    return `${gy}-${gm.toString().padStart(2, '0')}-${gd.toString().padStart(2, '0')}`;
  } catch (error) {
    console.error('❌ Error converting date:', jalaliStr, error.message);
    return null;
  }
}

async function importAppointments() {
  console.log('\n📥 Import نوبت‌ها از فایل Excel\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // خواندن فایل Excel
    const filePath = '../Appointments.xlsx';
    console.log(`📁 خواندن فایل: ${filePath}\n`);
    
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    console.log(`📊 تعداد ردیف‌ها: ${data.length}\n`);

    if (data.length === 0) {
      console.log('⚠️ فایل خالی است!\n');
      return;
    }

    // نمایش نمونه اولین ردیف
    console.log('🔍 نمونه اولین ردیف:');
    console.log(JSON.stringify(data[0], null, 2));
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Import تک به تک
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // تبدیل تاریخ
        let scheduledAt = row.scheduledAt || row['تاریخ'] || row.date;
        
        if (!scheduledAt) {
          throw new Error('تاریخ موجود نیست');
        }

        // اگر جلالی است، تبدیل کن
        if (typeof scheduledAt === 'string' && scheduledAt.includes('/')) {
          // فرمت: 1404/04/15 10:00
          const [datePart, timePart = '10:00'] = scheduledAt.split(' ');
          const gregorianDate = jalaliToGregorian(datePart);
          
          if (!gregorianDate) {
            throw new Error(`تبدیل تاریخ ناموفق: ${scheduledAt}`);
          }
          
          scheduledAt = `${gregorianDate}T${timePart}:00`;
        }

        // پارس کردن serviceIds
        let serviceIds = row.serviceIds || row['سرویس‌ها'] || row.services;
        if (typeof serviceIds === 'string') {
          serviceIds = JSON.parse(serviceIds);
        }
        if (!Array.isArray(serviceIds)) {
          serviceIds = [serviceIds];
        }

        // ساخت appointment
        const appointment = await prisma.appointment.create({
          data: {
            scheduledAt: new Date(scheduledAt),
            customerId: Number(row.customerId || row['شناسه مشتری'] || 1),
            employeeId: Number(row.employeeId || row['شناسه کارمند'] || 1),
            status: row.status || row['وضعیت'] || 'COMPLETED',
            amount: row.amount ? BigInt(row.amount) : null,
            tipAmount: row.tipAmount ? BigInt(row.tipAmount) : null,
            notes: row.notes || row['یادداشت'] || null,
            durationMin: Number(row.durationMin || row['مدت'] || 30),
            services: {
              connect: serviceIds.map(id => ({ id: Number(id) })),
            },
          },
        });

        successCount++;
        
        if (successCount % 50 === 0) {
          console.log(`✅ Import شد: ${successCount} نوبت...`);
        }

      } catch (error) {
        errorCount++;
        errors.push({
          row: i + 1,
          data: row,
          error: error.message,
        });
        
        if (errorCount <= 5) {
          console.error(`❌ ردیف ${i + 1}: ${error.message}`);
        }
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 گزارش نهایی:\n');
    console.log(`   ✅ موفق: ${successCount} نوبت`);
    console.log(`   ❌ خطا: ${errorCount} نوبت\n`);

    if (errors.length > 0 && errors.length <= 10) {
      console.log('❌ خطاها:\n');
      errors.forEach(e => {
        console.log(`   ردیف ${e.row}: ${e.error}`);
      });
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (successCount > 0) {
      console.log('✅ Import با موفقیت انجام شد!');
      console.log('🔄 حالا صفحه appointments رو refresh کن\n');
    }

  } catch (error) {
    console.error('❌ خطای کلی:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importAppointments();

