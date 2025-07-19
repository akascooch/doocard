import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function updateAdminPassword() {
  try {
    console.log('🔍 Finding admin user...');
    
    const adminUser = await prisma.user.findFirst({
      where: {
        username: 'admin'
      }
    });

    if (!adminUser) {
      console.error('❌ Admin user not found!');
      return;
    }

    console.log('✅ Found admin user:', {
      id: adminUser.id,
      username: adminUser.username,
      currentPassword: adminUser.password
    });

    // Hash the new password
    const newPassword = '123456';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    const updatedUser = await prisma.user.update({
      where: {
        id: adminUser.id
      },
      data: {
        password: hashedPassword
      }
    });

    console.log('✅ Password updated successfully!');
    console.log('New hashed password:', hashedPassword);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdminPassword(); 