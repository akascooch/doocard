#!/usr/bin/env ts-node
/**
 * Fix appointment prices - multiply by 10
 * (We divided by 10 instead of keeping original price)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPrices() {
  console.log('\n💰 Fixing Appointment Prices\n');
  console.log('⚠️  This will multiply all appointment amounts by 10\n');

  try {
    // Get all appointments with amount
    const appointments = await prisma.appointment.findMany({
      where: {
        amount: { not: null },
      },
      select: {
        id: true,
        amount: true,
        services: true,
      },
    });

    console.log(`📊 Found ${appointments.length} appointments with amounts\n`);
    console.log('🔄 Updating prices...\n');

    let updated = 0;
    let errors = 0;

    for (const appointment of appointments) {
      try {
        // Current amount
        const currentAmount = appointment.amount ? Number(appointment.amount) : 0;
        
        // New amount (multiply by 10)
        const newAmount = currentAmount * 10;

        // Update appointment amount
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: {
            amount: BigInt(newAmount),
          },
        });

        // Update services JSON priceAtBooking
        if (appointment.services && Array.isArray(appointment.services)) {
          const updatedServices = appointment.services.map((service: any) => ({
            ...service,
            priceAtBooking: (service.priceAtBooking || 0) * 10,
          }));

          await prisma.appointment.update({
            where: { id: appointment.id },
            data: {
              services: updatedServices,
            },
          });
        }

        // Update AppointmentService records
        const appointmentServices = await prisma.appointmentService.findMany({
          where: { appointmentId: appointment.id },
        });

        for (const as of appointmentServices) {
          await prisma.appointmentService.update({
            where: { id: as.id },
            data: {
              price: as.price * 10,
            },
          });
        }

        updated++;
        
        if (updated % 500 === 0) {
          console.log(`📊 Progress: ${updated}/${appointments.length}`);
        }

      } catch (error) {
        errors++;
        console.error(`❌ Error updating appointment ${appointment.id}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Price Fix Summary:\n');
    console.log(`✅ Updated: ${updated}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('='.repeat(50));

    // Verify
    const sample = await prisma.appointment.findFirst({
      where: { amount: { not: null } },
      select: { id: true, amount: true, services: true },
    });

    if (sample) {
      console.log('\n📋 Sample after fix:');
      console.log(`ID: ${sample.id}`);
      console.log(`Amount: ${sample.amount} Rials`);
      console.log(`Services:`, JSON.stringify(sample.services, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixPrices();

