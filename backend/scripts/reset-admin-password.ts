import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function resetAdminPassword() {
  try {
    console.log('🔐 Resetting admin password...');

    const phone = '09370504588';
    const newPassword = 'Lord7knows';

    // Find user
    const user = await prisma.user.findFirst({
      where: { phone },
    });

    if (!user) {
      console.error('❌ User not found with phone:', phone);
      process.exit(1);
    }

    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    console.log('🔐 New password hash:', hashedPassword.substring(0, 20) + '...');

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    console.log('✅ Password updated successfully!');

    // Verify password
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    const match = await bcrypt.compare(newPassword, updatedUser!.password);
    console.log('🔍 Password verification:', match ? '✅ MATCH' : '❌ NO MATCH');

    if (match) {
      console.log('');
      console.log('🎉 Admin password reset complete!');
      console.log('📱 Phone:', phone);
      console.log('🔑 Password:', newPassword);
      console.log('👤 Role:', user.role);
    } else {
      console.error('❌ Password verification failed!');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error resetting password:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPassword();

