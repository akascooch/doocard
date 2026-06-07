import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function setupDoocardProduction() {
  console.log('🚀 Setting up Doocard Production Database...');

  try {
    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const adminUser = await prisma.user.upsert({
      where: { phone: '09123456789' },
      update: {},
      create: {
        name: 'مدیر سیستم',
        phone: '09123456789',
        email: 'admin@doocard.com',
        password: adminPassword,
        role: 'ADMIN',
      },
    });

    console.log('✅ Admin user created:', adminUser.name);

    // Create sample employee
    const employeePassword = await bcrypt.hash('employee123', 12);
    const employeeUser = await prisma.user.upsert({
      where: { phone: '09123456788' },
      update: {},
      create: {
        name: 'کارمند نمونه',
        phone: '09123456788',
        email: 'employee@doocard.com',
        password: employeePassword,
        role: 'EMPLOYEE',
      },
    });

    const employee = await prisma.employee.upsert({
      where: { userId: employeeUser.id },
      update: {},
      create: {
        userId: employeeUser.id,
        specialty: 'آرایشگر عمومی',
        baseSalary: 5000000,
        commissionRate: 0.3,
      },
    });

    console.log('✅ Employee created:', employeeUser.name);

    // Create sample customer
    const customerPassword = await bcrypt.hash('customer123', 12);
    const customerUser = await prisma.user.upsert({
      where: { phone: '09123456787' },
      update: {},
      create: {
        name: 'مشتری نمونه',
        phone: '09123456787',
        email: 'customer@doocard.com',
        password: customerPassword,
        role: 'CUSTOMER',
      },
    });

    const customer = await prisma.customer.upsert({
      where: { userId: customerUser.id },
      update: {},
      create: {
        userId: customerUser.id,
        birthdate: new Date('1990-01-01'),
        notes: 'مشتری نمونه سیستم',
      },
    });

    console.log('✅ Customer created:', customerUser.name);

    // Create sample services
    const services = [
      {
        name: 'آرایش صورت',
        category: 'آرایش',
        durationMinutes: 60,
        price: 150000,
      },
      {
        name: 'کاشت ناخن',
        category: 'ناخن',
        durationMinutes: 90,
        price: 200000,
      },
      {
        name: 'مراقبت پوست',
        category: 'پوست',
        durationMinutes: 45,
        price: 100000,
      },
      {
        name: 'رنگ مو',
        category: 'مو',
        durationMinutes: 120,
        price: 300000,
      },
      {
        name: 'کوتاهی مو',
        category: 'مو',
        durationMinutes: 30,
        price: 80000,
      },
    ];

    for (const serviceData of services) {
      const existingService = await prisma.service.findFirst({
        where: { name: serviceData.name },
      });
      
      if (!existingService) {
        const service = await prisma.service.create({
          data: serviceData,
        });
        console.log('✅ Service created:', service.name);
      } else {
        console.log('✅ Service already exists:', existingService.name);
      }
    }

    // Create sample categories
    const categories = [
      { name: 'درآمد خدمات', type: 'INCOME' as const },
      { name: 'درآمد انعام', type: 'INCOME' as const },
      { name: 'هزینه مواد', type: 'EXPENSE' as const },
      { name: 'هزینه تجهیزات', type: 'EXPENSE' as const },
      { name: 'هزینه حقوق', type: 'EXPENSE' as const },
      { name: 'هزینه اجاره', type: 'EXPENSE' as const },
    ];

    for (const categoryData of categories) {
      const existingCategory = await prisma.category.findFirst({
        where: { name: categoryData.name },
      });
      
      if (!existingCategory) {
        const category = await prisma.category.create({
          data: categoryData,
        });
        console.log('✅ Category created:', category.name);
      } else {
        console.log('✅ Category already exists:', existingCategory.name);
      }
    }

    // Create homepage details
    const homepageDetails = await prisma.homepageDetails.upsert({
      where: { id: 1 },
      update: {},
      create: {
        about: 'سالن زیبایی Doocard با بیش از 10 سال تجربه در ارائه خدمات زیبایی و آرایشی، آماده خدمت‌رسانی به شما عزیزان است. ما با تیم حرفه‌ای و تجهیزات مدرن، بهترین خدمات را ارائه می‌دهیم.',
        team: 'تیم ما شامل آرایشگران و متخصصان مجرب در زمینه‌های مختلف زیبایی است که با دانش و تجربه خود، بهترین نتایج را برای شما به ارمغان می‌آورند.',
        products: 'ما از بهترین و باکیفیت‌ترین محصولات آرایشی و بهداشتی استفاده می‌کنیم که سلامت و زیبایی شما را تضمین می‌کند.',
        trainings: 'دوره‌های آموزشی تخصصی در زمینه آرایش، کاشت ناخن، مراقبت پوست و سایر خدمات زیبایی برای علاقه‌مندان برگزار می‌شود.',
        testimonials: 'نظرات مثبت مشتریان ما نشان‌دهنده کیفیت خدمات و رضایت آن‌ها از کار ماست.',
        contact: 'آماده پاسخگویی به سوالات شما هستیم. با ما در تماس باشید.',
      },
    });

    console.log('✅ Homepage details created');

    console.log('\n🎉 Doocard Production Database Setup Complete!');
    console.log('\n📋 Default Login Credentials:');
    console.log('👑 Admin: 09123456789 / admin123');
    console.log('👨‍💼 Employee: 09123456788 / employee123');
    console.log('👤 Customer: 09123456787 / customer123');
    console.log('\n🌐 Database: MOVA on localhost:5433');
    console.log('🔗 Backend: http://localhost:3001');
    console.log('🎨 Frontend: http://localhost:3000');

  } catch (error) {
    console.error('❌ Error setting up database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

setupDoocardProduction()
  .catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });