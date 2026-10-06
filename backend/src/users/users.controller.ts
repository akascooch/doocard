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
  UseGuards,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HIDDEN_USER_MESSAGE, UsersService } from './users.service';
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
      throw new ForbiddenException('فقط ادمین می‌تواند کاربر جدید ایجاد کند');
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
    this.assertCanListUsers(req.user);
    console.log('🔍 GET /users called by role:', req.user?.role);
    
    const result = await this.usersService.findAll(req.user);
    console.log('✅ Users result:', result.length, 'users');
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: any) {
    const id = req.user?.userId || req.user?.id;
    return this.usersService.findOne(id, req.user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    this.assertStaffOrSelf(req.user, id);
    return this.usersService.findOne(id, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const currentUser = req.user;
    console.log('🗑️ Delete request for user:', id, 'by:', currentUser);
    
    // پیدا کردن کاربر
    const user = await this.usersService.findOne(id, currentUser);
    if (!user) {
      console.log('❌ User not found:', id);
      return { success: false, message: 'User not found' };
    }

    console.log('✅ User found:', user);

    // بررسی دسترسی حذف
    if (!currentUser || currentUser.role !== 'ADMIN') {
      console.log('❌ Unauthorized delete attempt');
      throw new ForbiddenException('شما مجاز به حذف کاربران نیستید');
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
    console.log('🔧 PATCH /users/:id called with id:', id, 'by role:', req.user?.role);
    this.assertStaffOrSelf(req.user, id);
    try {
      const result = await this.usersService.update(id, updateUserDto, req.user);
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
  async syncUserRole(@Body() body, @Req() req: any) {
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenException('فقط ادمین می‌تواند نقش کاربر را همگام کند');
    }
    const { userId, role } = body;
    // پیدا کردن کاربر
    const user = await this.usersService.findOne(Number(userId), req.user);
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
  async checkUserRole(
    @Query('userId') userId: string,
    @Query('role') role: string,
    @Req() req: any,
  ) {
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenException('فقط ادمین می‌تواند نقش کاربر را بررسی کند');
    }
    // پیدا کردن کاربر
    const user = await this.usersService.findOne(Number(userId), req.user);
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
  async convertToEmployee(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenException('فقط ادمین می‌تواند مشتری را به کارمند تبدیل کند');
    }
    // پیدا کردن کاربر
    const user = await this.usersService.findOne(id, req.user);
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    if (user.role !== 'CUSTOMER') {
      throw new BadRequestException('فقط کاربران مشتری قابل تبدیل به کارمند هستند');
    }

    await this.usersService.update(id, { role: 'EMPLOYEE' }, req.user);

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
      user: await this.usersService.findOne(id, req.user)
    };
  }

  @Patch(':id/password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { password: string },
    @Req() req: any,
  ) {
    console.log('🔑 PATCH /users/:id/password called with id:', id, 'by role:', req.user?.role);
    
    const currentUser = req.user;
    
    // بررسی دسترسی - ادمین می‌تواند رمز هر کسی را تغییر دهد، کاربران فقط رمز خود
    if (!currentUser) {
      throw new UnauthorizedException('کاربر احراز هویت نشده است');
    }
    
    if (currentUser.role !== 'ADMIN' && currentUser.id !== id) {
      throw new NotFoundException(HIDDEN_USER_MESSAGE);
    }

    try {
      const _result = await this.usersService.changePassword(id, body.password, currentUser);
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

  private assertCanListUsers(currentUser?: { role?: string }): void {
    const role = currentUser?.role;
    if (role === 'ADMIN') {
      return;
    }
    throw new ForbiddenException('دسترسی به فهرست کاربران مجاز نیست');
  }

  private assertStaffOrSelf(
    currentUser: { id?: number; role?: string } | undefined,
    targetUserId: number,
  ): void {
    const role = currentUser?.role;
    if (role === 'ADMIN' || currentUser?.id === targetUserId) {
      return;
    }
    throw new NotFoundException(HIDDEN_USER_MESSAGE);
  }
}
