#!/usr/bin/env ts-node
/**
 * Fix appointment prices - FINAL
 * Excel has prices in TOMANS (not Rials)
 * Current DB: prices are in Rials but 10x too small
 * Fix: Multiply by 10 to get correct Rial amount
 * Display: Will show in Tomans (÷10)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAndFix() {
  console.log('\n🔍 Checking current prices...\n');

  // Sample appointment
  const sample = await prisma.appointment.findFirst({
    where: { amount: { not: null } },
    select: { id: true, amount: true, services: true },
    orderBy: { id: 'asc' },
  });

  if (!sample) {
    console.log('❌ No appointments found');
    process.exit(1);
  }

  const currentAmount = Number(sample.amount);
  console.log('Current amount in DB:', currentAmount, 'Rials');
  console.log('Display in Tomans:', Math.round(currentAmount / 10));

  // Check if already fixed
  if (currentAmount >= 100000000) {
    console.log('\n✅ Prices already look correct (>= 100M Rials = >= 10M Tomans)');
    console.log('No fix needed.');
    await prisma.$disconnect();
    return;
  }

  console.log('\n⚠️  Prices are too small. Need to multiply by 10.\n');
  console.log('Starting fix in 3 seconds...\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('🔄 Fixing all appointment prices...\n');

  const appointments = await prisma.appointment.findMany({
    where: { amount: { not: null } },
    select: { id: true, amount: true, services: true },
  });

  let updated = 0;

  for (const apt of appointments) {
    const currentAmt = Number(apt.amount);
    const newAmt = currentAmt * 10;

    // Update appointment
    await prisma.appointment.update({
      where: { id: apt.id },
      data: { amount: BigInt(newAmt) },
    });

    // Update services JSON
    if (apt.services && Array.isArray(apt.services)) {
      const updatedServices = apt.services.map((s: any) => ({
        ...s,
        priceAtBooking: (s.priceAtBooking || 0) * 10,
      }));
      await prisma.appointment.update({
        where: { id: apt.id },
        data: { services: updatedServices },
      });
    }

    // Update AppointmentService
    await prisma.appointmentService.updateMany({
      where: { appointmentId: apt.id },
      data: { price: { multiply: 10 } },
    });

    updated++;
    if (updated % 500 === 0) {
      console.log(`Progress: ${updated}/${appointments.length}`);
    }
  }

  console.log(`\n✅ Updated ${updated} appointments`);

  // Verify
  const verify = await prisma.appointment.findFirst({
    where: { id: sample.id },
    select: { amount: true },
  });

  console.log('\nVerification:');
  console.log('Before:', currentAmount, 'Rials =', Math.round(currentAmount / 10), 'Tomans');
  console.log('After:', Number(verify.amount), 'Rials =', Math.round(Number(verify.amount) / 10), 'Tomans');

  await prisma.$disconnect();
}

checkAndFix();

