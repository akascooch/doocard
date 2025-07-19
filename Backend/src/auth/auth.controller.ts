import { Controller, Post, Body, Get, UseGuards, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginDto);
    // ست کردن کوکی session-only (بدون expires و maxAge)
    res.cookie('token', result.access_token, {
      httpOnly: true,
      secure: false, // برای لوکال باید false باشد
      sameSite: 'lax', // برای لوکال مناسب است
      // بدون expires و maxAge
    });
    return { user: result.user };
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // Debug endpoint - remove in production
  @Get('debug/users')
  async getUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return users;
  }

  // Debug endpoint with all fields - remove in production
  @Get('debug/users/all')
  async getUsersWithAllFields() {
    console.log('Fetching all users with all fields...');
    const users = await this.prisma.user.findMany();
    console.log('Found users:', users.length);
    return users;
  }

  // Debug endpoint to check password - remove in production
  @Post('debug/check-password')
  async checkPassword(@Body() data: { password: string }) {
    const hashedPassword = '$2b$10$GsVjpqCXuYYzT1C.kpmuCOalG2JPhvOm3gCWrAcbQZYC2uiJ1rcdC';
    const match = await bcrypt.compare(data.password, hashedPassword);
    console.log('🔍 Checking password:', {
      providedPassword: data.password,
      match: match
    });
    return { match };
  }
}
