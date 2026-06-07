import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMigration() {
  try {
    console.log('🔍 Checking migration results...');
    
    // Check all tables
    const tables = [
      'user', 'profile', 'barber', 'service', 'customer', 'appointment',
      'appointmentService', 'transaction', 'financialCategory', 'financialEntry',
      'bankAccount', 'salary', 'tipTransaction', 'barberWithdrawalRequest',
      'setting', 'permission', 'smsLog', 'smsSettings', 'smsTemplate'
    ];
    
    console.log('📊 Migration Results:');
    console.log('=====================');
    
    for (const table of tables) {
      try {
        const count = await (prisma as any)[table].count();
        console.log(`${table.padEnd(25)}: ${count} records`);
      } catch (error) {
        console.log(`${table.padEnd(25)}: Error - ${error.message}`);
      }
    }
    
    // Check some specific data
    console.log('\n📊 Sample Data Check:');
    console.log('=====================');
    
    // Check users
    const users = await prisma.user.findMany({ take: 3 });
    console.log('Users:', users.map(u => ({ id: u.id, email: u.email, role: u.role })));
    
    // Check barbers
    const barbers = await prisma.barber.findMany({ take: 3 });
    console.log('Barbers:', barbers.map(b => ({ id: b.id, name: `${b.firstName} ${b.lastName}`, email: b.email })));
    
    // Check customers
    const customers = await prisma.customer.findMany({ take: 3 });
    console.log('Customers:', customers.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, phone: c.phoneNumber })));
    
    // Check appointments
    const appointments = await prisma.appointment.findMany({ take: 3 });
    console.log('Appointments:', appointments.map(a => ({ id: a.id, date: a.date, status: a.status })));
    
    // Check financial entries
    const entries = await prisma.financialEntry.findMany({ take: 3 });
    console.log('Financial Entries:', entries.map(e => ({ id: e.id, amount: e.amount, type: e.type, description: e.description })));
    
    // Check withdrawal requests
    const withdrawals = await prisma.barberWithdrawalRequest.findMany({ take: 3 });
    console.log('Withdrawal Requests:', withdrawals.map(w => ({ id: w.id, amount: w.amount, status: w.status })));
    
    console.log('\n✅ Migration check completed!');
    
  } catch (error) {
    console.error('❌ Error checking migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMigration(); 