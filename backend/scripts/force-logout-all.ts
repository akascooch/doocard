#!/usr/bin/env ts-node
/**
 * Force logout ALL users by revoking all refresh tokens
 * This will force everyone to login again with fresh JWT
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function forceLogoutAll() {
  console.log('\n🚨 Force logout ALL users\n');
  console.log('='.repeat(60));

  try {
    // Get count of active refresh tokens
    const activeTokens = await prisma.refreshToken.count({
      where: { isRevoked: false },
    });

    console.log(`\n📊 Found ${activeTokens} active refresh tokens\n`);

    if (activeTokens === 0) {
      console.log('✅ No active tokens to revoke');
      await prisma.$disconnect();
      return;
    }

    // Revoke all tokens
    const result = await prisma.refreshToken.updateMany({
      where: { isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    console.log(`✅ Revoked ${result.count} refresh tokens`);
    console.log('\n' + '='.repeat(60));
    console.log('✅ All users are now logged out');
    console.log('📱 They need to login again to use the app');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

forceLogoutAll();

