import { PrismaClient, AppointmentStatus, CategoryType, EntryType, EntryStatus, TransactionCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // پاک کردن داده‌های قبلی
  await prisma.transaction.deleteMany();
  await prisma.appointmentService.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.service.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.salary.deleteMany();
  await prisma.barber.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.smsLog.deleteMany();
  await prisma.smsTemplate.deleteMany();
  await prisma.smsSettings.deleteMany();
  await prisma.financialEntry.deleteMany();
  await prisma.financialCategory.deleteMany();
  await prisma.user.deleteMany();

  // ایجاد کاربر ادمین
  const hashedPassword = await bcrypt.hash('123456', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: hashedPassword,
      firstName: 'مدیر',
      lastName: 'سیستم',
      phoneNumber: '09120000000',
      role: 'ADMIN',
      updatedAt: new Date(),
    },
  });

  // ایجاد آرایشگرها
  const barbers = await Promise.all([
    prisma.barber.create({
      data: {
        email: 'barber1@example.com',
        firstName: 'علی',
        lastName: 'محمدی',
        phoneNumber: '09123456789',
        bio: 'متخصص اصلاح مو و ریش با 10 سال سابقه',
        avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
        updatedAt: new Date(),
      },
    }),
    prisma.barber.create({
      data: {
        email: 'barber2@example.com',
        firstName: 'رضا',
        lastName: 'احمدی',
        phoneNumber: '09123456788',
        bio: 'متخصص رنگ مو و اصلاح مدرن',
        avatar: 'https://randomuser.me/api/portraits/men/2.jpg',
        updatedAt: new Date(),
      },
    }),
    prisma.barber.create({
      data: {
        email: 'barber3@example.com',
        firstName: 'محمد',
        lastName: 'حسینی',
        phoneNumber: '09123456787',
        bio: 'متخصص اصلاح مو و رنگ با 15 سال سابقه',
        avatar: 'https://randomuser.me/api/portraits/men/3.jpg',
        updatedAt: new Date(),
      },
    }),
    prisma.barber.create({
      data: {
        email: 'barber4@example.com',
        firstName: 'حسین',
        lastName: 'کریمی',
        phoneNumber: '09123456786',
        bio: 'متخصص اصلاح مدرن و فشن',
        avatar: 'https://randomuser.me/api/portraits/men/4.jpg',
        updatedAt: new Date(),
      },
    }),
  ]);

  // ایجاد مشتری‌ها
  const customers = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      prisma.customer.create({
        data: {
          email: `customer${i + 1}@example.com`,
          firstName: ['علی', 'رضا', 'محمد', 'حسین', 'امیر', 'مهدی', 'سعید', 'جواد', 'کاظم', 'احمد'][
            i % 10
          ],
          lastName: ['رضایی', 'علوی', 'حسینی', 'کریمی', 'محمدی', 'احمدی', 'موسوی', 'هاشمی', 'صادقی', 'نجفی'][
            i % 10
          ],
          phoneNumber: `091234567${i.toString().padStart(2, '0')}`,
          birthDate: new Date(1980 + i, i % 12, (i % 28) + 1),
          gender: i % 2 === 0 ? 'MALE' : 'FEMALE',
          notes: i % 3 === 0 ? 'مشتری ثابت' : undefined,
          updatedAt: new Date(),
        },
      })
    )
  );

  // ایجاد خدمات
  const services = await Promise.all([
    prisma.service.create({
      data: {
        name: 'اصلاح مو',
        description: 'اصلاح مو به سبک کلاسیک',
        price: 100000,
        duration: 30,
        updatedAt: new Date(),
        barbers: {
          connect: barbers.map(b => ({ id: b.id })),
        },
      },
    }),
    prisma.service.create({
      data: {
        name: 'اصلاح ریش',
        description: 'اصلاح و فرم‌دهی ریش',
        price: 50000,
        duration: 20,
        updatedAt: new Date(),
        barbers: {
          connect: [{ id: barbers[0].id }, { id: barbers[2].id }],
        },
      },
    }),
    prisma.service.create({
      data: {
        name: 'رنگ مو',
        description: 'رنگ کردن مو با بهترین متریال',
        price: 200000,
        duration: 60,
        updatedAt: new Date(),
        barbers: {
          connect: [{ id: barbers[1].id }, { id: barbers[3].id }],
        },
      },
    }),
    prisma.service.create({
      data: {
        name: 'اصلاح مو و ریش',
        description: 'پکیج کامل اصلاح مو و ریش',
        price: 130000,
        duration: 45,
        updatedAt: new Date(),
        barbers: {
          connect: barbers.map(b => ({ id: b.id })),
        },
      },
    }),
    prisma.service.create({
      data: {
        name: 'رنگ ریش',
        description: 'رنگ کردن ریش',
        price: 80000,
        duration: 30,
        updatedAt: new Date(),
        barbers: {
          connect: [{ id: barbers[0].id }, { id: barbers[2].id }],
        },
      },
    }),
  ]);

  // ایجاد نوبت‌ها
  const appointments = await Promise.all(
    Array.from({ length: 50 }, async (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + (i % 14)); // نوبت‌ها برای 2 هفته آینده
      date.setHours(9 + Math.floor((i % 8) * 1.5), 0, 0); // ساعت‌های کاری از 9 صبح تا 9 شب

      const statuses: AppointmentStatus[] = [
        AppointmentStatus.PENDING,
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED
      ];

      // ایجاد نوبت بدون serviceId
      const appointment = await prisma.appointment.create({
        data: {
          customerId: customers[i % customers.length].id,
          barberId: barbers[i % barbers.length].id,
          date,
          status: statuses[i % 4],
          notes: i % 5 === 0 ? 'درخواست مدل خاص' : undefined,
          updatedAt: new Date(),
        },
      });

      // انتخاب تصادفی 1 تا 3 خدمت برای هر نوبت
      const numServices = Math.floor(Math.random() * 3) + 1;
      const shuffledServices = services.sort(() => 0.5 - Math.random());
      const selectedServices = shuffledServices.slice(0, numServices);

      // درج رکوردهای AppointmentService
      await Promise.all(selectedServices.map(service =>
        prisma.appointmentService.create({
          data: {
            appointmentId: appointment.id,
            serviceId: service.id,
            price: service.price,
            updatedAt: new Date(),
          },
        })
      ));

      return appointment;
    })
  );

  // ایجاد تراکنش‌ها برای نوبت‌های تکمیل شده
  await Promise.all(
    appointments
      .filter(app => app.status === 'COMPLETED')
      .map(async app => {
        // جمع مبلغ خدمات این نوبت
        const appServices = await prisma.appointmentService.findMany({
          where: { appointmentId: app.id },
        });
        const totalAmount = appServices.reduce((sum, s) => sum + s.price, 0);
        return prisma.transaction.create({
          data: {
            appointment: { connect: { id: app.id } },
            amount: totalAmount,
            paymentMethod: 'نقدی',
            status: 'COMPLETED',
            updatedAt: new Date(),
            type: 'SERVICE',
          },
        });
      })
  );

  // ایجاد قالب‌های پیامک
  await prisma.smsTemplate.create({
    data: {
      name: 'یادآوری نوبت',
      content: 'مشتری گرامی {name}، نوبت شما برای {service} در تاریخ {date} با آرایشگر {barber} ثبت شده است.',
      variables: ['name', 'service', 'date', 'barber'],
      updatedAt: new Date(),
    },
  });

  await prisma.smsTemplate.create({
    data: {
      name: 'پیگیری نوبت',
      content: 'مشتری گرامی {name}، امیدواریم از خدمات ما راضی بوده باشید. لطفاً نظرات خود را با ما در میان بگذارید.',
      variables: ['name'],
      updatedAt: new Date(),
    },
  });

  // ایجاد تنظیمات پیامک
  await prisma.smsSettings.create({
    data: {
      apiKey: '',
      lineNumber: '',
      isEnabled: false,
      sendBeforeAppointment: 60,
      sendAfterAppointment: 0,
      defaultMessage: '',
      updatedAt: new Date(),
    },
  });

  // ایجاد دسته‌بندی‌های مالی
  const categories = await Promise.all([
    // دسته‌بندی‌های درآمد
    prisma.financialCategory.create({
      data: {
        name: 'درآمد خدمات',
        type: CategoryType.INCOME,
        description: 'درآمد حاصل از ارائه خدمات آرایشگری',
        updatedAt: new Date(),
      },
    }),
    prisma.financialCategory.create({
      data: {
        name: 'فروش محصولات',
        type: CategoryType.INCOME,
        description: 'درآمد حاصل از فروش محصولات آرایشی',
        updatedAt: new Date(),
      },
    }),
    // دسته‌بندی‌های هزینه
    prisma.financialCategory.create({
      data: {
        name: 'حقوق و دستمزد',
        type: CategoryType.EXPENSE,
        description: 'پرداخت حقوق به کارکنان',
        updatedAt: new Date(),
      },
    }),
    prisma.financialCategory.create({
      data: {
        name: 'اجاره',
        type: CategoryType.EXPENSE,
        description: 'هزینه اجاره ماهانه',
        updatedAt: new Date(),
      },
    }),
    prisma.financialCategory.create({
      data: {
        name: 'قبوض',
        type: CategoryType.EXPENSE,
        description: 'هزینه آب، برق، گاز و تلفن',
        updatedAt: new Date(),
      },
    }),
    prisma.financialCategory.create({
      data: {
        name: 'خرید لوازم مصرفی',
        type: CategoryType.EXPENSE,
        description: 'خرید مواد و لوازم مصرفی آرایشگاه',
        updatedAt: new Date(),
      },
    }),
  ]);

  // ایجاد تراکنش‌های مالی نمونه
  const currentDate = new Date();
  await Promise.all(
    Array.from({ length: 50 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (i % 30)); // تراکنش‌های 30 روز گذشته

      const isIncome = i % 3 === 0;
      const category = isIncome
        ? categories.find(c => c.type === CategoryType.INCOME)
        : categories.find(c => c.type === CategoryType.EXPENSE);

      return prisma.financialEntry.create({
        data: {
          amount: isIncome ? 100000 + (i * 50000) : -(50000 + (i * 20000)),
          type: isIncome ? EntryType.INCOME : EntryType.EXPENSE,
          date,
          description: isIncome
            ? 'درآمد از خدمات آرایشگری'
            : ['خرید مواد مصرفی', 'پرداخت قبض برق', 'خرید لوازم بهداشتی'][i % 3],
          categoryId: category!.id,
          reference: isIncome ? `INVOICE-${1000 + i}` : `BILL-${2000 + i}`,
          paymentMethod: ['CASH', 'CARD', 'ONLINE'][i % 3],
          createdBy: admin.id,
          status: EntryStatus.COMPLETED,
          updatedAt: new Date(),
        },
      });
    })
  );

  // ایجاد حقوق‌های نمونه برای آرایشگرها
  await Promise.all(
    barbers.flatMap(barber =>
      Array.from({ length: 3 }, (_, i) => {
        const month = new Date();
        month.setMonth(month.getMonth() - i);
        return prisma.salary.create({
          data: {
            barberId: barber.id,
            amount: 5000000 + (Math.random() * 2000000),
            month,
            isPaid: i === 0 ? false : true,
            paidAt: i === 0 ? null : new Date(month.getTime() + (24 * 60 * 60 * 1000)),
            description: `حقوق ماهانه ${month.toLocaleDateString('fa-IR', { month: 'long', year: 'numeric' })}`,
            updatedAt: new Date(),
          },
        });
      })
    )
  );

  // آپدیت تراکنش‌های موجود با دسته‌بندی
  // این بخش حذف شد چون category هنگام ساخت تراکنش مقداردهی می‌شود و id تراکنش با id نوبت یکی نیست.

  console.log('داده‌های اولیه با موفقیت اضافه شدند');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 