import {
  Controller,
  Get,
  Delete,
  Param,
  Req,
  NotFoundException,
  Patch,
  Body,
  Post,
  ParseIntPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from './users.service';
import { Role } from '../common/enums';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}


  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createUserDto: CreateUserDto, @Req() req: any) {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'ADMIN') {
      throw new Error('فقط ادمین می‌تواند کاربر جدید ایجاد کند');
    }
    try {
      const user = await this.usersService.create(createUserDto);
      return {
        success: true,
        data: user,
        message: 'کاربر با موفقیت ایجاد شد'
      };
    } catch (error) {
      throw error;
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req: any) {
    console.log('🔍 GET /users called');
    console.log('Request user:', req.user);
    console.log('Request headers:', req.headers);
    
    const currentUser = req.user;
    console.log('Current user for service:', currentUser);
    
    const result = await this.usersService.findAll();
    console.log('✅ Users result:', result.length, 'users');
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: any) {
    return this.usersService.findOne(req.user?.userId || req.user?.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const currentUser = req.user;
    return this.usersService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const currentUser = req.user;
    console.log('🗑️ Delete request for user:', id, 'by:', currentUser);
    
    // پیدا کردن کاربر
    const user = await this.usersService.findOne(id);
    if (!user) {
      console.log('❌ User not found:', id);
      return { success: false, message: 'User not found' };
    }

    console.log('✅ User found:', user);

    // بررسی دسترسی حذف
    if (!currentUser || currentUser.role !== 'ADMIN') {
      console.log('❌ Unauthorized delete attempt');
      throw new Error('شما مجاز به حذف کاربران نیستید');
    }

    try {
      // حذف از جدول مربوطه بر اساس نقش
      if (user.role === 'CUSTOMER') {
        await this.prisma.customer.deleteMany({ where: { userId: user.id } });
        console.log('🗑️ Removed from customers table');
      } else if (user.role === 'EMPLOYEE') {
        await this.prisma.employee.deleteMany({ where: { userId: user.id } });
        console.log('🗑️ Removed from employees table');
      }

      // حذف از جدول users
      await this.usersService.remove(id);
      console.log('✅ User deleted successfully');

      return { success: true, message: 'کاربر با موفقیت حذف شد' };
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      throw new Error('خطا در حذف کاربر');
    }
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: any,
  ) {
    console.log('🔧 PATCH /users/:id called with id:', id);
    console.log('Update data:', updateUserDto);
    console.log('Current user:', req.user);
    
    const currentUser = req.user;
    try {
      const result = await this.usersService.update(id, updateUserDto);
      console.log('✅ Update result:', result);
      return {
        success: true,
        data: result,
        message: 'کاربر با موفقیت به‌روزرسانی شد'
      };
    } catch (error) {
      console.error('❌ Error updating user:', error);
      throw error;
    }
  }

  @Post('sync-role')
  @UseGuards(JwtAuthGuard)
  async syncUserRole(@Body() body) {
    const { userId, role } = body;
    // پیدا کردن کاربر
    const user = await this.usersService.findOne(Number(userId));
    if (!user) return { success: false, message: 'User not found' };
    
    if (role === 'CUSTOMER') {
      // چک کن اگر در جدول customers نیست، اضافه کن
      const exists = await this.prisma.customer.findFirst({ where: { userId: user.id } });
      if (!exists) {
        await this.prisma.customer.create({
          data: {
            userId: user.id,
            birthdate: new Date(),
            notes: '',
            updatedAt: new Date(),
          },
        });
        return { success: true, message: 'Customer synced' };
      }
      return { success: true, message: 'Customer already exists' };
    } else if (role === 'EMPLOYEE') {
      const exists = await this.prisma.employee.findFirst({ where: { userId: user.id } });
      if (!exists) {
        await this.prisma.employee.create({
          data: {
            userId: user.id,
            specialty: 'General',
            baseSalary: 0,
            commissionRate: 0,
            updatedAt: new Date(),
          },
        });
        return { success: true, message: 'Employee synced' };
      }
      return { success: true, message: 'Employee already exists' };
    }
    return { success: false, message: 'Invalid role' };
  }

  @Get('sync-role/check')
  @UseGuards(JwtAuthGuard)
  async checkUserRole(@Query('userId') userId: string, @Query('role') role: string) {
    // پیدا کردن کاربر
    const user = await this.usersService.findOne(Number(userId));
    if (!user) return { exists: false };
    if (role === 'CUSTOMER') {
      const exists = await this.prisma.customer.findFirst({ where: { userId: user.id } });
      return { exists: !!exists };
    } else if (role === 'EMPLOYEE') {
      const exists = await this.prisma.employee.findFirst({ where: { userId: user.id } });
      return { exists: !!exists };
    }
    return { exists: false };
  }

  @Post('convert-to-employee/:id')
  @UseGuards(JwtAuthGuard)
  async convertToEmployee(@Param('id', ParseIntPipe) id: number) {
    // پیدا کردن کاربر
    const user = await this.usersService.findOne(id);
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    if (user.role !== 'CUSTOMER') {
      throw new Error('فقط کاربران مشتری قابل تبدیل به کارمند هستند');
    }

    // تبدیل نقش کاربر به EMPLOYEE
    await this.usersService.update(id, { role: 'EMPLOYEE' });

    // حذف از جدول مشتریان
    await this.prisma.customer.deleteMany({ where: { userId: user.id } });

    // اضافه کردن به جدول کارمندان
    await this.prisma.employee.create({
      data: {
        userId: user.id,
        specialty: 'General',
        baseSalary: 0,
        commissionRate: 0,
        updatedAt: new Date(),
      },
    });

    return { 
      success: true, 
      message: 'کاربر با موفقیت به کارمند تبدیل شد',
      user: await this.usersService.findOne(id)
    };
  }

  @Patch(':id/password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { password: string },
    @Req() req: any,
  ) {
    console.log('🔑 PATCH /users/:id/password called with id:', id);
    console.log('Current user:', req.user);
    
    const currentUser = req.user;
    
    // بررسی دسترسی - ادمین می‌تواند رمز هر کسی را تغییر دهد، کاربران فقط رمز خود
    if (!currentUser) {
      throw new Error('کاربر احراز هویت نشده است');
    }
    
    if (currentUser.role !== 'ADMIN' && currentUser.id !== id) {
      throw new Error('شما فقط مجاز به تغییر رمز عبور خود هستید');
    }

    try {
      const result = await this.usersService.changePassword(id, body.password);
      console.log('✅ Password changed successfully for user:', id);
      return {
        success: true,
        message: 'رمز عبور با موفقیت تغییر کرد'
      };
    } catch (error) {
      console.error('❌ Error changing password:', error);
      throw error;
    }
  }
}
