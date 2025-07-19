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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { RolesGuard } from '../auth/roles.guard';
// import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';
import { Role } from '../auth/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
// @UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  // @Roles(Role.ADMIN)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  // @Roles(Role.ADMIN)
  async findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: any) {
    return this.usersService.findOne(req.user?.userId || req.user?.id);
  }

  @Get(':id')
  // @Roles(Role.ADMIN)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Delete(':id')
  // @Roles(Role.ADMIN)
  async remove(@Param('id', ParseIntPipe) id: number) {
    // پیدا کردن کاربر
    const user = await this.usersService.findOne(id);
    if (!user) return { success: false, message: 'User not found' };

    // حذف از جدول مربوطه بر اساس نقش
    if (user.role === 'CUSTOMER') {
      await this.prisma.customer.deleteMany({ where: { email: user.email } });
    } else if (user.role === 'BARBER' || user.role === 'STAFF') {
      await this.prisma.barber.deleteMany({ where: { email: user.email } });
    }

    // حذف از جدول users
    await this.usersService.remove(id);

    return { success: true };
  }

  @Patch(':id')
  // @Roles(Role.ADMIN)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Post('sync-role')
  async syncUserRole(@Body() body) {
    const { userId, role } = body;
    // پیدا کردن کاربر
    const user = await this.usersService.findOne(Number(userId));
    if (!user) return { success: false, message: 'User not found' };
    if (role === 'CUSTOMER') {
      // چک کن اگر در جدول customers نیست، اضافه کن
      const exists = await this.prisma.customer.findFirst({ where: { email: user.email } });
      if (!exists) {
        await this.prisma.customer.create({
          data: {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            isActive: user.isActive,
            updatedAt: user.updatedAt,
          },
        });
        return { success: true, message: 'Customer synced' };
      }
      return { success: true, message: 'Customer already exists' };
    } else if (role === 'BARBER') {
      const exists = await this.prisma.barber.findUnique({ where: { email: user.email } });
      if (!exists) {
        await this.prisma.barber.create({
          data: {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            isActive: user.isActive,
            updatedAt: user.updatedAt,
          },
        });
        return { success: true, message: 'Barber synced' };
      }
      return { success: true, message: 'Barber already exists' };
    }
    return { success: false, message: 'Invalid role' };
  }

  @Get('sync-role/check')
  async checkUserRole(@Query('userId') userId: string, @Query('role') role: string) {
    // پیدا کردن کاربر
    const user = await this.usersService.findOne(Number(userId));
    if (!user) return { exists: false };
    if (role === 'CUSTOMER') {
      const exists = await this.prisma.customer.findFirst({ where: { email: user.email } });
      return { exists: !!exists };
    } else if (role === 'BARBER') {
      const exists = await this.prisma.barber.findUnique({ where: { email: user.email } });
      return { exists: !!exists };
    }
    return { exists: false };
  }

  @Post('convert-to-barber/:id')
  async convertToBarber(@Param('id', ParseIntPipe) id: number) {
    // پیدا کردن کاربر
    const user = await this.usersService.findOne(id);
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    if (user.role !== 'CUSTOMER') {
      throw new Error('فقط کاربران مشتری قابل تبدیل به آرایشگر هستند');
    }

    // تبدیل نقش کاربر به BARBER
    await this.usersService.update(id, { role: 'BARBER' });

    // حذف از جدول مشتریان
    await this.prisma.customer.deleteMany({ where: { email: user.email } });

    // اضافه کردن به جدول آرایشگران
    await this.prisma.barber.create({
      data: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        isActive: user.isActive,
        updatedAt: new Date(),
      },
    });

    return { 
      success: true, 
      message: 'کاربر با موفقیت به آرایشگر تبدیل شد',
      user: await this.usersService.findOne(id)
    };
  }
}
