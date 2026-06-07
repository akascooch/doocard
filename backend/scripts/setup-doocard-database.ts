import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Setting up Doocard database...')

  try {
    // Create default admin user
    const hashedPassword = await bcrypt.hash('admin123', 12)
    
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@doocard.com' },
      update: {},
      create: {
        firstName: 'مدیر',
        lastName: 'سیستم',
        phoneNumber: '09123456789',
        email: 'admin@doocard.com',
        password: hashedPassword,
        role: 'ADMIN',
        updatedAt: new Date(),
      },
    })

    console.log('✅ Admin user created:', adminUser.email)

    // Create default employee (barber)
    const employee = await prisma.barber.upsert({
      where: { email: 'employee@doocard.com' },
      update: {},
      create: {
        firstName: 'کارمند',
        lastName: 'نمونه',
        phoneNumber: '09123456788',
        email: 'employee@doocard.com',
        bio: 'آرایش و زیبایی',
        salaryPercentage: 10,
        balance: 5000000,
        updatedAt: new Date(),
      },
    })

    console.log('✅ Employee created:', employee.email)

    // Create default customer
    const customer = await prisma.customer.upsert({
      where: { phoneNumber: '09123456787' },
      update: {},
      create: {
        firstName: 'مشتری',
        lastName: 'نمونه',
        phoneNumber: '09123456787',
        email: 'customer@doocard.com',
        birthDate: new Date('1990-01-01'),
        notes: 'مشتری نمونه',
        updatedAt: new Date(),
      },
    })

    console.log('✅ Customer created:', customer.email)

    // Create default services
    const services = [
      {
        name: 'آرایش صورت',
        description: 'آرایش حرفه‌ای صورت',
        duration: 60,
        price: 150000,
        updatedAt: new Date(),
      },
      {
        name: 'کاشت ناخن',
        description: 'کاشت و طراحی ناخن',
        duration: 90,
        price: 200000,
        updatedAt: new Date(),
      },
      {
        name: 'مراقبت پوست',
        description: 'مراقبت و جوانسازی پوست',
        duration: 45,
        price: 100000,
        updatedAt: new Date(),
      },
      {
        name: 'رنگ مو',
        description: 'رنگ و هایلایت مو',
        duration: 120,
        price: 300000,
        updatedAt: new Date(),
      },
    ]

    for (const serviceData of services) {
      const service = await prisma.service.create({
        data: serviceData,
      })
      console.log('✅ Service created:', service.name)
    }

    // Skip categories for now as they don't exist in current schema
    console.log('⚠️ Categories skipped - not in current schema')

    // Create default homepage details
    const homepageDetails = await prisma.homepageDetails.upsert({
      where: { id: 1 },
      update: {},
      create: {
        about: 'سالن زیبایی Doocard با بیش از 10 سال تجربه در ارائه خدمات زیبایی و آرایشی، آماده خدمت‌رسانی به شما عزیزان است.',
        team: 'تیم حرفه‌ای ما شامل متخصصان با تجربه در زمینه‌های مختلف زیبایی و آرایش است.',
        products: 'ما مجموعه کاملی از خدمات زیبایی شامل آرایش، کاشت ناخن، مراقبت پوست و رنگ مو ارائه می‌دهیم.',
        trainings: 'دوره‌های آموزشی تخصصی برای علاقه‌مندان به یادگیری مهارت‌های زیبایی و آرایش.',
        testimonials: 'نظرات مثبت مشتریان راضی ما نشان‌دهنده کیفیت بالای خدمات ماست.',
        contact: 'آماده پاسخگویی به سوالات شما و ارائه مشاوره رایگان هستیم.',
      },
    })

    console.log('✅ Homepage details created')

    console.log('🎉 Database setup completed successfully!')
    console.log('📋 Default credentials:')
    console.log('   Admin: admin@doocard.com / admin123')
    console.log('   Employee: employee@doocard.com / admin123')
    console.log('   Customer: customer@doocard.com / admin123')

  } catch (error) {
    console.error('❌ Error setting up database:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
