import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CustomerRegistrationSmsService } from '../sms/customer-registration-sms.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private readonly customerRegistrationSms: CustomerRegistrationSmsService,
  ) {}

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
        const preferredEmployeeId = await this.resolvePreferredEmployeeId(
          createUserDto.preferredEmployeeId,
        );
        await this.prisma.customer.create({
          data: {
            userId: user.id,
            birthdate: createUserDto.birthdate
              ? new Date(createUserDto.birthdate)
              : undefined,
            notes: createUserDto.notes,
            preferredEmployeeId,
            updatedAt: new Date(),
          },
        });
        console.log(`✅ کاربر ${user.name} به جدول مشتریان اضافه شد`);
        try {
          await this.customerRegistrationSms.handleNewCustomer({
            name: user.name || createUserDto.name,
            phone: user.phone || createUserDto.phone,
            userId: user.id,
            source: 'admin_create',
            preferredEmployeeId,
          });
        } catch (smsErr: any) {
          this.logger.error(
            '[CustomerRegistration SMS error] ' + (smsErr?.message || 'unknown'),
          );
        }
      } catch (error) {
        console.error(`❌ خطا در اضافه کردن کاربر به جدول مشتریان:`, error);
        // If error occurs, delete the user
        await this.prisma.user.delete({
          where: { id: user.id },
        });
        throw error;
      }
    }

    // If user is EMPLOYEE or SERVICE, also add to employees table (tip/salary flows need Employee row)
    if (createUserDto.role === 'EMPLOYEE' || createUserDto.role === 'SERVICE') {
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

    // Name is NOT unique — allow free display-name edits.
    const nextName =
      updateUserDto.name !== undefined
        ? String(updateUserDto.name).trim()
        : undefined;
    if (nextName !== undefined && nextName.length === 0) {
      throw new ConflictException('نام نمی‌تواند خالی باشد');
    }

    // Phone is unique — only conflict-check when it actually changes.
    if (updateUserDto.phone && updateUserDto.phone !== user.phone) {
      const phoneOwner = await this.prisma.user.findUnique({
        where: { phone: updateUserDto.phone },
      });
      if (phoneOwner && phoneOwner.id !== id) {
        throw new ConflictException('شماره تلفن قبلاً ثبت شده است');
      }
    }

    // Hash password if provided
    let hashedPassword = user.password;
    if (updateUserDto.password) {
      hashedPassword = await bcrypt.hash(updateUserDto.password, 12);
    }

    try {
      // Update user
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          ...(nextName !== undefined && { name: nextName }),
          ...(updateUserDto.phone && { phone: updateUserDto.phone }),
          ...(updateUserDto.email !== undefined && {
            email: updateUserDto.email || null,
          }),
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
      if (updateUserDto.role === 'EMPLOYEE' || updateUserDto.role === 'SERVICE') {
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
    } catch (err: any) {
      // Map phone unique violations only; never treat name as unique.
      if (err?.code === 'P2002') {
        const targets: string[] = err?.meta?.target || [];
        if (targets.includes('phone') || targets.some((t) => String(t).includes('phone'))) {
          throw new ConflictException('شماره تلفن قبلاً ثبت شده است');
        }
        this.logger.error('Unexpected unique constraint on user update', err);
        throw new ConflictException('به‌روزرسانی کاربر با محدودیت یکتایی مواجه شد');
      }
      throw err;
    }
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

  /**
   * Resolve preferred barber for new CUSTOMER users.
   * Uses explicit id when valid/active, else isDefault, else first active.
   */
  private async resolvePreferredEmployeeId(
    preferredEmployeeId?: number,
  ): Promise<number | null> {
    if (preferredEmployeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: preferredEmployeeId },
      });
      if (employee?.isActive) return employee.id;
    }
    const defaultEmployee = await this.prisma.employee.findFirst({
      where: { isDefault: true, isActive: true },
    });
    if (defaultEmployee) return defaultEmployee.id;
    const firstActive = await this.prisma.employee.findFirst({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });
    return firstActive ? firstActive.id : null;
  }
}