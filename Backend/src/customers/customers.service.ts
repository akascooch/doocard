import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(createCustomerDto: CreateCustomerDto) {
    try {
      // تبدیل تاریخ تولد به فرمت ISO-8601 کامل
      const data = {
        ...createCustomerDto,
        updatedAt: new Date(),
      };
      
      if (data.birthDate) {
        // اگر فقط تاریخ باشد (بدون زمان)، زمان 00:00:00 اضافه کن
        const birthDate = new Date(data.birthDate);
        if (isNaN(birthDate.getTime())) {
          throw new Error('فرمت تاریخ تولد نامعتبر است');
        }
        data.birthDate = birthDate.toISOString();
      }
      // استخراج barberId و حذف از data
      const { barberId, ...rest } = data;
      // اگر ایمیل undefined یا خالی بود، مقدار null قرار بده
      if (!rest.email) {
        rest.email = null;
      }
      // ایجاد مشتری جدید
      const customer = await this.prisma.customer.create({
        data: {
          ...rest,
          ...(barberId ? { barber: { connect: { id: barberId } } } : {}),
        },
      });

      // ایجاد کاربر جدید با نقش CUSTOMER
      if (customer.email) {
        try {
          // تولید رمز عبور تصادفی
          const randomPassword = Math.random().toString(36).slice(-8);
          const hashedPassword = await bcrypt.hash(randomPassword, 10);
          await this.prisma.user.create({
            data: {
              email: customer.email,
              firstName: customer.firstName,
              lastName: customer.lastName,
              phoneNumber: customer.phoneNumber,
              password: hashedPassword,
              role: 'CUSTOMER',
              isActive: true,
              updatedAt: new Date(),
            },
          });
          console.log(`✅ مشتری ${customer.email} به جدول کاربران اضافه شد`);
          console.log(`🔑 رمز عبور موقت: ${randomPassword}`);
        } catch (userError) {
          console.error(`❌ خطا در اضافه کردن مشتری به جدول کاربران:`, userError);
          // اگر خطا رخ داد، مشتری را حذف کن
          await this.prisma.customer.delete({
            where: { id: customer.id },
          });
          throw new Error('خطا در ثبت مشتری. لطفاً دوباره تلاش کنید.');
        }
      }

      return customer;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('ایمیل یا شماره موبایل قبلاً ثبت شده است.');
      }
      if (error.message === 'فرمت تاریخ تولد نامعتبر است') {
        throw new ConflictException('فرمت تاریخ تولد نامعتبر است. لطفاً تاریخ صحیح وارد کنید.');
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.customer.findMany({
      where: {
        isActive: true,
      },
      include: {
        barber: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.customer.findUnique({
      where: { id },
    });
  }

  async findByPhone(phoneNumber: string) {
    if (!phoneNumber) {
      return null;
    }
    return this.prisma.customer.findUnique({
      where: { phoneNumber },
    });
  }

  update(id: number, updateCustomerDto: UpdateCustomerDto) {
    // تبدیل تاریخ تولد به فرمت ISO-8601 کامل
    const data = {
      ...updateCustomerDto,
      updatedAt: new Date(),
    };
    
    if (data.birthDate) {
      // اگر فقط تاریخ باشد (بدون زمان)، زمان 00:00:00 اضافه کن
      const birthDate = new Date(data.birthDate);
      if (isNaN(birthDate.getTime())) {
        throw new ConflictException('فرمت تاریخ تولد نامعتبر است. لطفاً تاریخ صحیح وارد کنید.');
      }
      data.birthDate = birthDate.toISOString();
    }
    
    return this.prisma.customer.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    const appointments = await this.prisma.appointment.findMany({
      where: { customerId: id },
      select: { id: true },
    });
    
    if (appointments.length > 0) {
      throw new ConflictException('امکان حذف این مشتری وجود ندارد، زیرا به قرار ملاقات‌هایی متصل است.');
    }
    
    return this.prisma.customer.delete({
      where: { id },
    });
  }
} 