#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAmirSub() {
  await prisma.pushSubscription.deleteMany({
    where: { userId: 3 } // Amir mova
  });
  console.log('✅ Deleted Amir mova subscription');
  await prisma.$disconnect();
}

deleteAmirSub();

