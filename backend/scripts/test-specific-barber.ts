import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSpecificBarber() {
  try {
    console.log('🔍 Testing specific barber data...');
    
    // Test with specific barber email
    const barberEmail = 'scooch@example.com';
    
    // 1. Find barber by email
    const barber = await prisma.barber.findFirst({
      where: { email: barberEmail },
    });
    
    console.log('🔍 Found barber:', barber);
    
    if (!barber) {
      console.log('❌ Barber not found');
      return;
    }
    
    // 2. Get barber's appointments
    const appointments = await prisma.appointment.findMany({
      where: { barberId: barber.id },
      include: {
        customer: true,
        barber: true,
        services: { include: { service: true } },
        transactions: {
          include: {
            financialEntry: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });
    
    console.log('📊 Found appointments for barber:', appointments.length);
    appointments.forEach(apt => {
      console.log(`- Appointment ${apt.id}: ${apt.customer?.firstName} ${apt.customer?.lastName} - Status: ${apt.status}`);
      console.log(`  Services: ${apt.services.map(s => s.service.name).join(', ')}`);
      console.log(`  Transactions: ${apt.transactions.length}`);
    });
    
    // 3. Get financial entries related to this barber
    const financialEntries = await prisma.financialEntry.findMany({
      where: {
        transactions: {
          some: {
            appointment: {
              barberId: barber.id,
            },
          },
        },
      },
      include: {
        category: true,
        bankAccount: true,
        transactions: {
          include: {
            appointment: {
              include: {
                barber: true,
                customer: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });
    
    console.log('📊 Found financial entries for barber:', financialEntries.length);
    financialEntries.forEach(entry => {
      console.log(`- Entry ${entry.id}: ${entry.description} - Amount: ${entry.amount}`);
      entry.transactions.forEach(trans => {
        console.log(`  - Transaction ${trans.id}: ${trans.amount} - Appointment: ${trans.appointment?.id}`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSpecificBarber(); 