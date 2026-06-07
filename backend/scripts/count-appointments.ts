import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function countAppointments() {
  try {
    const count = await prisma.appointment.count();
    console.log(`📊 Total appointments: ${count}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

countAppointments();

