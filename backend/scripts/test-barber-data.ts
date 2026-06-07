import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testBarberData() {
  try {
    console.log('🔍 Testing barber data...');
    
    // 1. Check all barbers
    const barbers = await prisma.barber.findMany({
      include: {
        appointments: true,
      },
    });
    
    console.log('📊 Found barbers:', barbers.length);
    barbers.forEach(barber => {
      console.log(`- ${barber.firstName} ${barber.lastName} (${barber.email}): ${barber.appointments.length} appointments`);
    });
    
    // 2. Check all appointments
    const appointments = await prisma.appointment.findMany({
      include: {
        barber: true,
        customer: true,
      },
    });
    
    console.log('📊 Found appointments:', appointments.length);
    appointments.forEach(apt => {
      console.log(`- Appointment ${apt.id}: ${apt.barber?.firstName} ${apt.barber?.lastName} -> ${apt.customer?.firstName} ${apt.customer?.lastName}`);
    });
    
    // 3. Check financial entries
    const financialEntries = await prisma.financialEntry.findMany({
      include: {
        transactions: {
          include: {
            appointment: {
              include: {
                barber: true,
              },
            },
          },
        },
      },
    });
    
    console.log('📊 Found financial entries:', financialEntries.length);
    financialEntries.forEach(entry => {
      console.log(`- Entry ${entry.id}: ${entry.description} - Transactions: ${entry.transactions.length}`);
      entry.transactions.forEach(trans => {
        console.log(`  - Transaction ${trans.id}: Barber ${trans.appointment?.barber?.firstName} ${trans.appointment?.barber?.lastName}`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBarberData(); 