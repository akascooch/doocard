import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAllTables() {
  try {
    console.log('🔍 Checking all tables in database...\n');

    // Check Users
    const users = await prisma.user.findMany();
    console.log('👥 Users:', users.length);
    console.log(JSON.stringify(users, null, 2));
    console.log('\n-------------------\n');

    // Check Barbers
    const barbers = await prisma.barber.findMany();
    console.log('💇‍♂️ Barbers:', barbers.length);
    console.log(JSON.stringify(barbers, null, 2));
    console.log('\n-------------------\n');

    // Check Services
    const services = await prisma.service.findMany();
    console.log('✂️ Services:', services.length);
    console.log(JSON.stringify(services, null, 2));
    console.log('\n-------------------\n');

    // Check BarberServices
    const barberServices = await prisma.barberService.findMany();
    console.log('🔄 Barber Services:', barberServices.length);
    console.log(JSON.stringify(barberServices, null, 2));
    console.log('\n-------------------\n');

    // Check Customers
    const customers = await prisma.customer.findMany();
    console.log('👤 Customers:', customers.length);
    console.log(JSON.stringify(customers, null, 2));
    console.log('\n-------------------\n');

    // Check Appointments
    const appointments = await prisma.appointment.findMany();
    console.log('📅 Appointments:', appointments.length);
    console.log(JSON.stringify(appointments, null, 2));
    console.log('\n-------------------\n');

    // Check AppointmentServices
    const appointmentServices = await prisma.appointmentService.findMany();
    console.log('🔄 Appointment Services:', appointmentServices.length);
    console.log(JSON.stringify(appointmentServices, null, 2));
    console.log('\n-------------------\n');

    // Check SMS Templates
    const smsTemplates = await prisma.smsTemplate.findMany();
    console.log('📱 SMS Templates:', smsTemplates.length);
    console.log(JSON.stringify(smsTemplates, null, 2));
    console.log('\n-------------------\n');

    // Check SMS Logs
    const smsLogs = await prisma.smsLog.findMany();
    console.log('📝 SMS Logs:', smsLogs.length);
    console.log(JSON.stringify(smsLogs, null, 2));
    console.log('\n-------------------\n');

    // Check SMS Settings
    const smsSettings = await prisma.smsSettings.findMany();
    console.log('⚙️ SMS Settings:', smsSettings.length);
    console.log(JSON.stringify(smsSettings, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllTables(); 