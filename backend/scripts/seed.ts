import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  try {
    // Create admin user
    const hashedPassword = await bcrypt.hash('123456', 10);
    const admin = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        phoneNumber: '09120000000',
        role: 'ADMIN',
        updatedAt: new Date(),
      },
    });
    console.log('Admin user created:', admin);

    // Create services
    const services = await Promise.all([
      prisma.service.create({
        data: {
          name: 'اصلاح مو',
          description: 'اصلاح مو به همراه شستشو',
          price: 100000,
          duration: 30,
          updatedAt: new Date(),
        },
      }),
      prisma.service.create({
        data: {
          name: 'اصلاح ریش',
          description: 'اصلاح و مرتب کردن ریش',
          price: 50000,
          duration: 20,
          updatedAt: new Date(),
        },
      }),
      prisma.service.create({
        data: {
          name: 'رنگ مو',
          description: 'رنگ کردن مو به همراه شستشو',
          price: 200000,
          duration: 60,
          updatedAt: new Date(),
        },
      }),
    ]);
    console.log('Services created:', services);

    // Create barbers
    const barbers = await Promise.all([
      prisma.barber.create({
        data: {
          firstName: 'محمد',
          lastName: 'محمدی',
          phoneNumber: '09123456789',
          email: 'mohammad@example.com',
          updatedAt: new Date(),
          services: {
            connect: [{ id: services[0].id }, { id: services[1].id }]
          }
        },
      }),
      prisma.barber.create({
        data: {
          firstName: 'علی',
          lastName: 'علوی',
          phoneNumber: '09123456788',
          email: 'ali@example.com',
          updatedAt: new Date(),
          services: {
            connect: [{ id: services[0].id }, { id: services[2].id }]
          }
        },
      }),
    ]);
    console.log('Barbers created:', barbers);

    // Create customers
    const customers = await Promise.all([
      prisma.customer.create({
        data: {
          firstName: 'رضا',
          lastName: 'رضایی',
          phoneNumber: '09123456787',
          email: 'reza@example.com',
          updatedAt: new Date(),
        },
      }),
      prisma.customer.create({
        data: {
          firstName: 'حسن',
          lastName: 'حسینی',
          phoneNumber: '09123456786',
          email: 'hasan@example.com',
          updatedAt: new Date(),
        },
      }),
      prisma.customer.create({
        data: {
          firstName: 'مهدی',
          lastName: 'مهدوی',
          phoneNumber: '09123456785',
          email: 'mehdi@example.com',
          updatedAt: new Date(),
        },
      }),
    ]);
    console.log('Customers created:', customers);

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main(); 