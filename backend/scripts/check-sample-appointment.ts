#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const apt = await prisma.appointment.findFirst({
    where: { id: 3440 },
    select: { id: true, amount: true, services: true },
  });

  console.log('\nSample appointment #3440:');
  console.log(JSON.stringify(apt, null, 2));
  console.log('\nAmount in Rials:', Number(apt.amount));
  console.log('Display in Tomans:', Math.round(Number(apt.amount) / 10));

  await prisma.$disconnect();
}

check();

