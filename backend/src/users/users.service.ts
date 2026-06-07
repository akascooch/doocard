import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    // Hash password before saving user
    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);
    
    // Check if phone number already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { phone: createUserDto.phone },
    });

    if (existingUser) {
      throw new ConflictException('شماره تلفن قبلاً ثبت شده است');
    }

    // Check if email already exists (if provided)
    if (createUserDto.email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: createUserDto.email },
      });

      if (existingEmail) {
        throw new ConflictException('ایمیل قبلاً ثبت شده است');
      }
    }
    
    // Create new user
    const user = await this.prisma.user.create({
      data: {
        name: createUserDto.name,
        phone: createUserDto.phone,
        email: createUserDto.email,
        password: hashedPassword,
        role: (createUserDto.role || 'CUSTOMER') as any,
        updatedAt: new Date(),
      },
    });

    // If user is CUSTOMER, also add to customers table
    if (createUserDto.role === 'CUSTOMER') {
      try {
        await this.prisma.customer.create({
          data: {
            userId: user.id,
            birthdate: createUserDto.birthdate,
            notes: createUserDto.notes,
            updatedAt: new Date(),
          },
        });
        console.log(`✅ کاربر ${user.name} به جدول مشتریان اضافه شد`);
      } catch (error) {
        console.error(`❌ خطا در اضافه کردن کاربر به جدول مشتریان:`, error);
        // If error occurs, delete the user
        await this.prisma.user.delete({
          where: { id: user.id },
        });
        throw error;
      }
    }

    // If user is EMPLOYEE, also add to employees table
    if (createUserDto.role === 'EMPLOYEE') {
      try {
        await this.prisma.employee.create({
          data: {
            userId: user.id,
            specialty: createUserDto.specialty,
            baseSalary: createUserDto.baseSalary || 0,
            commissionRate: createUserDto.commissionRate || 0,
            updatedAt: new Date(),
          },
        });
        console.log(`✅ کاربر ${user.name} به جدول کارمندان اضافه شد`);
      } catch (error) {
        console.error(`❌ خطا در اضافه کردن کاربر به جدول کارمندان:`, error);
        // If error occurs, delete the user
        await this.prisma.user.delete({
          where: { id: user.id },
        });
        throw error;
      }
    }

    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      include: {
        customer: true,
        employee: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        customer: true,
        employee: true,
      },
    });

    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    return user;
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
      include: {
        customer: true,
        employee: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email },
      include: {
        customer: true,
        employee: true,
      },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    // Hash password if provided
    let hashedPassword = user.password;
    if (updateUserDto.password) {
      hashedPassword = await bcrypt.hash(updateUserDto.password, 12);
    }

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...(updateUserDto.name && { name: updateUserDto.name }),
        ...(updateUserDto.phone && { phone: updateUserDto.phone }),
        ...(updateUserDto.email && { email: updateUserDto.email }),
        ...(updateUserDto.password && { password: hashedPassword }),
        ...(updateUserDto.role && { role: updateUserDto.role as any }),
        updatedAt: new Date(),
      },
      include: {
        customer: true,
        employee: true,
      },
    });

    // Role sync: idempotent. No duplicate create; no delete of Employee.
    if (updateUserDto.role === 'EMPLOYEE') {
      await this.prisma.employee.upsert({
        where: { userId: id },
        create: { userId: id, isActive: true },
        update: { isActive: true },
      });
    } else if (updateUserDto.role === 'CUSTOMER') {
      await this.prisma.employee.updateMany({
        where: { userId: id },
        data: { isActive: false },
      });
    }

    // Re-fetch to include freshly created employee (if any) in the response
    const finalUser = await this.prisma.user.findUnique({
      where: { id },
      include: {
        customer: true,
        employee: true,
      },
    });

    return finalUser!;
  }

  async remove(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        customer: true,
        employee: true,
      },
    });

    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    // Delete related records first
    if (user.customer) {
      await this.prisma.customer.delete({
        where: { id: user.customer.id },
      });
    }

    if (user.employee) {
      await this.prisma.employee.delete({
        where: { id: user.employee.id },
      });
    }

    // Delete user
    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'کاربر با موفقیت حذف شد' };
  }

  async validateUser(phone: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: {
        customer: true,
        employee: true,
      },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    // Remove password from response
    const { password: _, ...result } = user;
    return result;
  }

  async getUsersByRole(role: string) {
    return this.prisma.user.findMany({
      where: { role: role as any },
      include: {
        customer: true,
        employee: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getUsersCount() {
    return this.prisma.user.count();
  }

  async getUsersCountByRole(role: string) {
    return this.prisma.user.count({
      where: { role: role as any },
    });
  }

  async changePassword(id: number, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    return updatedUser;
  }
}