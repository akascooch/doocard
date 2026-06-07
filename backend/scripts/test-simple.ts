import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSimple() {
  try {
    console.log('🔍 Simple test...');
    
    // Test barber lookup
    const barberEmail = 'scooch@example.com';
    const barber = await prisma.barber.findFirst({
      where: { email: barberEmail },
    });
    
    console.log('🔍 Found barber:', barber);
    
    if (barber) {
      // Test appointments for this barber
      const appointments = await prisma.appointment.findMany({
        where: { barberId: barber.id },
        include: {
          customer: true,
          barber: true,
        },
      });
      
      console.log('📊 Found appointments:', appointments.length);
      appointments.forEach(apt => {
        console.log(`- Appointment ${apt.id}: ${apt.customer?.firstName} ${apt.customer?.lastName} - Status: ${apt.status}`);
      });
      
      // Test financial entries for this barber
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
      });
      
      console.log('📊 Found financial entries:', financialEntries.length);
      financialEntries.forEach(entry => {
        console.log(`- Entry ${entry.id}: ${entry.description} - Amount: ${entry.amount}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSimple(); 