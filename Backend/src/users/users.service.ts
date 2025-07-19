import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    // هش کردن پسورد قبل از ذخیره کاربر
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    
    // ایجاد کاربر جدید
    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    // اگر کاربر با نقش CUSTOMER ثبت شده، به جدول مشتریان هم اضافه کن
    if (createUserDto.role === 'CUSTOMER') {
      try {
        await this.prisma.customer.create({
          data: {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            isActive: true,
            updatedAt: new Date(),
          },
        });
        console.log(`✅ کاربر ${user.email} به جدول مشتریان اضافه شد`);
      } catch (error) {
        console.error(`❌ خطا در اضافه کردن کاربر به جدول مشتریان:`, error);
        // اگر خطا رخ داد، کاربر را حذف کن
        await this.prisma.user.delete({
          where: { id: user.id },
        });
        throw new Error('خطا در ثبت‌نام. لطفاً دوباره تلاش کنید.');
      }
    }

    return user;
  }

  findAll() {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...updateUserDto,
        updatedAt: new Date(),
      },
    });
  }

  remove(id: number) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        isActive: true,
      },
    });
  }
}