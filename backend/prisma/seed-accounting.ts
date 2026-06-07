import { PrismaClient, TransactionType } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:Lord7know$@localhost:5433/MOVA'
    }
  }
});

async function seedAccounting() {
  console.log('🌱 Seeding accounting data...\n');

  // Create default bank account
  console.log('📦 Creating default bank account...');
  const defaultAccount = await prisma.bankAccount.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'حساب اصلی سالن',
      provider: 'بانک ملی',
      isDefault: true,
      isActive: true,
      balance: BigInt(0),
      description: 'حساب اصلی برای دریافت و پرداخت‌های روزانه سالن'
    }
  });
  console.log(`✅ Default account created: ${defaultAccount.name} (ID: ${defaultAccount.id})\n`);

  // Create income categories
  console.log('📁 Creating income categories...');
  const incomeCategories = [
    { name: 'درآمد خدمات', description: 'درآمد حاصل از ارائه خدمات به مشتریان' },
    { name: 'درآمد نوبت‌دهی', description: 'درآمد نوبت‌های تکمیل شده' },
    { name: 'فروش محصولات', description: 'فروش محصولات آرایشی و بهداشتی' },
    { name: 'انعام', description: 'انعام دریافتی از مشتریان' },
    { name: 'سایر درآمدها', description: 'سایر منابع درآمدی' },
  ];

  for (const cat of incomeCategories) {
    const created = await prisma.transactionCategory.upsert({
      where: { id: -1 }, // Dummy where for upsert
      update: {},
      create: {
        name: cat.name,
        type: TransactionType.INCOME,
        description: cat.description,
        isActive: true
      }
    });
    console.log(`  ✅ ${created.name}`);
  }

  // Create expense categories
  console.log('\n📁 Creating expense categories...');
  const expenseCategories = [
    { name: 'حقوق و دستمزد', description: 'پرداخت حقوق کارکنان' },
    { name: 'خرید مواد اولیه', description: 'خرید لوازم و مواد مصرفی' },
    { name: 'اجاره و آب و برق', description: 'هزینه‌های ثابت سالن' },
    { name: 'تعمیر و نگهداری', description: 'تعمیر تجهیزات و تعمیرات' },
    { name: 'بازاریابی و تبلیغات', description: 'هزینه‌های تبلیغاتی' },
    { name: 'مالیات و عوارض', description: 'پرداخت مالیات و عوارض' },
    { name: 'سایر هزینه‌ها', description: 'سایر هزینه‌های عملیاتی' },
  ];

  for (const cat of expenseCategories) {
    const created = await prisma.transactionCategory.upsert({
      where: { id: -1 },
      update: {},
      create: {
        name: cat.name,
        type: TransactionType.EXPENSE,
        description: cat.description,
        isActive: true
      }
    });
    console.log(`  ✅ ${created.name}`);
  }

  console.log('\n✅ Accounting seed completed!');
  console.log('\n📊 Summary:');
  console.log(`  - Bank Accounts: 1`);
  console.log(`  - Income Categories: ${incomeCategories.length}`);
  console.log(`  - Expense Categories: ${expenseCategories.length}`);
}

seedAccounting()
  .catch((e) => {
    console.error('❌ Error seeding accounting data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

