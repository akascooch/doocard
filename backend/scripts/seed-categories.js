const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const defaultCategories = [
  // Income Categories
  { name: 'درآمد خدمات', type: 'INCOME', description: 'درآمد حاصل از ارائه خدمات آرایشی' },
  { name: 'تیپ', type: 'INCOME', description: 'درآمد حاصل از انعام مشتریان' },
  { name: 'فروش محصولات', type: 'INCOME', description: 'درآمد حاصل از فروش محصولات آرایشی' },
  { name: 'سایر درآمدها', type: 'INCOME', description: 'سایر منابع درآمدی' },
  
  // Expense Categories
  { name: 'مواد مصرفی', type: 'EXPENSE', description: 'هزینه مواد و لوازم مصرفی' },
  { name: 'حقوق کارکنان', type: 'EXPENSE', description: 'هزینه حقوق و دستمزد کارکنان' },
  { name: 'اجاره', type: 'EXPENSE', description: 'هزینه اجاره محل کار' },
  { name: 'قبوض', type: 'EXPENSE', description: 'هزینه آب، برق، گاز و تلفن' },
  { name: 'تعمیرات', type: 'EXPENSE', description: 'هزینه تعمیرات و نگهداری' },
  { name: 'بازاریابی', type: 'EXPENSE', description: 'هزینه تبلیغات و بازاریابی' },
  { name: 'سایر هزینه‌ها', type: 'EXPENSE', description: 'سایر هزینه‌های جاری' },
];

async function seedCategories() {
  try {
    console.log('🌱 شروع افزودن دسته‌بندی‌های پیش‌فرض...');
    
    for (const category of defaultCategories) {
      const existingCategory = await prisma.financialCategory.findFirst({
        where: { name: category.name }
      });
      
      if (!existingCategory) {
        await prisma.financialCategory.create({
          data: {
            ...category,
            updatedAt: new Date()
          }
        });
        console.log(`✅ دسته‌بندی "${category.name}" اضافه شد`);
      } else {
        console.log(`⏭️ دسته‌بندی "${category.name}" قبلاً وجود دارد`);
      }
    }
    
    console.log('🎉 افزودن دسته‌بندی‌های پیش‌فرض با موفقیت انجام شد!');
  } catch (error) {
    console.error('❌ خطا در افزودن دسته‌بندی‌ها:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedCategories(); 