const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// تعریف صفحات و قابلیت‌های موجود در سیستم
const pages = [
  { key: 'dashboard', label: 'داشبورد' },
  { key: 'appointments', label: 'نوبت‌ها' },
  { key: 'customers', label: 'مشتریان' },
  { key: 'barbers', label: 'آرایشگران' },
  { key: 'services', label: 'خدمات' },
  { key: 'accounting', label: 'حسابداری' },
  { key: 'users', label: 'مدیریت کاربران' },
  { key: 'settings', label: 'تنظیمات' },
  { key: 'sms', label: 'پیامک' },
  { key: 'permissions', label: 'دسترسی‌ها' },
];

const features = [
  { key: 'view', label: 'مشاهده' },
  { key: 'create', label: 'ایجاد' },
  { key: 'edit', label: 'ویرایش' },
  { key: 'delete', label: 'حذف' },
];

// تعریف دسترسی‌های پیش‌فرض برای هر نقش
const defaultPermissions = {
  ADMIN: {
    // ادمین همه چیز را می‌بیند و می‌تواند انجام دهد
    dashboard: ['view', 'create', 'edit', 'delete'],
    appointments: ['view', 'create', 'edit', 'delete'],
    customers: ['view', 'create', 'edit', 'delete'],
    barbers: ['view', 'create', 'edit', 'delete'],
    services: ['view', 'create', 'edit', 'delete'],
    accounting: ['view', 'create', 'edit', 'delete'],
    users: ['view', 'create', 'edit', 'delete'],
    settings: ['view', 'create', 'edit', 'delete'],
    sms: ['view', 'create', 'edit', 'delete'],
    permissions: ['view', 'create', 'edit', 'delete'],
  },
  BARBER: {
    // آرایشگر دسترسی محدودتری دارد
    dashboard: ['view'],
    appointments: ['view', 'create', 'edit'],
    customers: ['view', 'create', 'edit'],
    barbers: ['view'],
    services: ['view'],
    accounting: ['view'],
    users: [],
    settings: [],
    sms: [],
    permissions: [],
  },
  CUSTOMER: {
    // مشتری فقط دسترسی‌های محدودی دارد
    dashboard: ['view'],
    appointments: ['view', 'create'],
    customers: ['view'],
    barbers: ['view'],
    services: ['view'],
    accounting: [],
    users: [],
    settings: [],
    sms: [],
    permissions: [],
  },
};

async function seedPermissions() {
  try {
    console.log('🌱 شروع افزودن دسترسی‌های پیش‌فرض...');

    // حذف تمام دسترسی‌های موجود
    await prisma.permission.deleteMany({});
    console.log('🗑️ دسترسی‌های قبلی حذف شدند');

    // ایجاد دسترسی‌های جدید برای هر نقش
    for (const [role, pagePermissions] of Object.entries(defaultPermissions)) {
      console.log(`\n📋 ایجاد دسترسی‌ها برای نقش: ${role}`);
      
      const permissionsToCreate = [];
      
      for (const [page, allowedFeatures] of Object.entries(pagePermissions)) {
        for (const feature of features) {
          const hasPermission = allowedFeatures.includes(feature.key);
          
          permissionsToCreate.push({
            role: role,
            page: page,
            feature: feature.key,
            canView: feature.key === 'view' ? hasPermission : false,
            canCreate: feature.key === 'create' ? hasPermission : false,
            canEdit: feature.key === 'edit' ? hasPermission : false,
            canDelete: feature.key === 'delete' ? hasPermission : false,
          });
        }
      }
      
      // ایجاد دسترسی‌ها در دیتابیس
      await prisma.permission.createMany({
        data: permissionsToCreate,
      });
      
      console.log(`✅ ${permissionsToCreate.length} دسترسی برای نقش ${role} ایجاد شد`);
    }

    console.log('\n🎉 افزودن دسترسی‌های پیش‌فرض با موفقیت انجام شد!');
    
    // نمایش خلاصه
    const totalPermissions = await prisma.permission.count();
    console.log(`📊 مجموع دسترسی‌های ایجاد شده: ${totalPermissions}`);
    
    for (const role of Object.keys(defaultPermissions)) {
      const rolePermissions = await prisma.permission.count({ where: { role } });
      console.log(`👤 نقش ${role}: ${rolePermissions} دسترسی`);
    }
    
  } catch (error) {
    console.error('❌ خطا در افزودن دسترسی‌ها:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedPermissions(); 