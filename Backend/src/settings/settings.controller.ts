import { Controller, Post, UseInterceptors, UploadedFile, Get, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('upload-logo')
  @UseInterceptors(FileInterceptor('logo', {
    storage: diskStorage({
      destination: './uploads/logos',
      filename: (req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        callback(null, `logo-${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
    fileFilter: (req: Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
      if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
        return callback(new Error('فقط فایل‌های تصویری مجاز هستند'), false);
      }
      callback(null, true);
    },
    limits: {
      fileSize: 1024 * 1024 * 2 // 2MB
    }
  }))
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    return {
      filename: file.filename,
      path: `/uploads/logos/${file.filename}`
    };
  }

  @Get('logo')
  @Roles(Role.ADMIN, Role.BARBER, Role.CUSTOMER)
  async getLogo() {
    // TODO: Get logo path from database or config
    return { path: '/uploads/logos/default-logo.png' };
  }

  @Post('reset-database')
  @Roles(Role.ADMIN)
  async resetDatabase() {
    try {
      console.log('🔄 شروع ریست کامل سیستم...');
      
      // 1. پاک کردن تمام داده‌ها
      console.log('🗑️ پاک کردن تمام داده‌ها...');
      
      await this.prisma.transaction.deleteMany();
      await this.prisma.appointmentService.deleteMany();
      await this.prisma.appointment.deleteMany();
      await this.prisma.financialEntry.deleteMany();
      await this.prisma.financialCategory.deleteMany();
      await this.prisma.salary.deleteMany();
      await this.prisma.service.deleteMany();
      await this.prisma.customer.deleteMany();
      await this.prisma.barber.deleteMany();
      await this.prisma.profile.deleteMany();
      await this.prisma.smsLog.deleteMany();
      await this.prisma.smsTemplate.deleteMany();
      await this.prisma.smsSettings.deleteMany();
      await this.prisma.user.deleteMany();
      
      console.log('✅ تمام داده‌ها پاک شدند');
      
      // 2. ایجاد کاربر ادمین
      console.log('👤 ایجاد کاربر ادمین...');
      
      const password = '123456';
      const hashedPassword = await bcrypt.hash(password, 10);

      const admin = await this.prisma.user.create({
        data: {
          email: 'admin@example.com',
          password: hashedPassword,
          firstName: 'مدیر',
          lastName: 'سیستم',
          phoneNumber: '09120000000',
          role: 'ADMIN',
          updatedAt: new Date(),
        },
      });

      console.log('✅ کاربر ادمین ایجاد شد');
      
      // 3. ایجاد تنظیمات اولیه SMS
      console.log('📱 ایجاد تنظیمات اولیه SMS...');
      
      await this.prisma.smsSettings.create({
        data: {
          apiKey: '',
          lineNumber: '',
          isEnabled: false,
          sendBeforeAppointment: 60,
          sendAfterAppointment: 0,
          defaultMessage: '',
          updatedAt: new Date(),
        },
      });

      console.log('✅ تنظیمات SMS ایجاد شد');
      
      // 4. ایجاد دسته‌بندی‌های مالی اولیه
      console.log('💰 ایجاد دسته‌بندی‌های مالی اولیه...');
      
      await this.prisma.financialCategory.createMany({
        data: [
          {
            name: 'درآمد خدمات',
            type: 'INCOME',
            description: 'درآمد حاصل از ارائه خدمات آرایشگری',
            updatedAt: new Date(),
          },
          {
            name: 'فروش محصولات',
            type: 'INCOME',
            description: 'درآمد حاصل از فروش محصولات آرایشی',
            updatedAt: new Date(),
          },
          {
            name: 'حقوق و دستمزد',
            type: 'EXPENSE',
            description: 'پرداخت حقوق به کارکنان',
            updatedAt: new Date(),
          },
          {
            name: 'اجاره',
            type: 'EXPENSE',
            description: 'هزینه اجاره ماهانه',
            updatedAt: new Date(),
          },
          {
            name: 'قبوض',
            type: 'EXPENSE',
            description: 'هزینه آب، برق، گاز و تلفن',
            updatedAt: new Date(),
          },
          {
            name: 'خرید لوازم مصرفی',
            type: 'EXPENSE',
            description: 'خرید مواد و لوازم مصرفی آرایشگاه',
            updatedAt: new Date(),
          },
        ],
      });

      console.log('✅ دسته‌بندی‌های مالی ایجاد شدند');
      
      return {
        success: true,
        message: 'ریست کامل با موفقیت انجام شد',
        adminUser: {
          email: admin.email,
          password: password,
        },
      };
      
    } catch (error) {
      console.error('❌ خطا در ریست کامل:', error);
      throw error;
    }
  }
} 