import { Controller, Post, Body, Get, UseGuards, Res, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Response, Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto, 
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request
  ) {
    // Get client info
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.login(loginDto, ipAddress, userAgent);
    
    // Set refresh token as HttpOnly secure cookie (30 days)
    res.cookie('refresh_token', result.refresh_token, {
      httpOnly: true, // Cannot be accessed by JavaScript
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax', // CSRF protection
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/', // Available for all routes
    });

    // Also set access token in cookie for SSR (optional)
    res.cookie('token', result.access_token, {
      httpOnly: false, // Frontend can read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    
    console.log('✅ Login successful, tokens set in cookies');
    
    return { 
      user: result.user,
      access_token: result.access_token // Also send in response for localStorage
    };
  }

  /**
   * Refresh access token using refresh token from cookie
   */
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const refreshToken = req.cookies?.refresh_token;
    
    if (!refreshToken) {
      throw new UnauthorizedException('رفرش توکن یافت نشد');
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.refreshAccessToken(refreshToken, ipAddress, userAgent);
    
    // Set new refresh token in cookie (token rotation)
    res.cookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });

    // Set new access token in cookie
    res.cookie('token', result.access_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    
    console.log('✅ Token refreshed successfully');
    
    return { 
      access_token: result.access_token,
      user: result.user
    };
  }

  /**
   * Logout - revoke refresh token
   */
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const refreshToken = req.cookies?.refresh_token;
    
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    
    // Clear all auth cookies
    res.clearCookie('refresh_token', { path: '/' });
    res.clearCookie('token', { path: '/' });
    
    console.log('✅ Logout successful');
    
    return { 
      success: true,
      message: 'با موفقیت خارج شدید'
    };
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
        name: true,
        email: true,
        phone: true,
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

  /**
   * Cleanup expired tokens (admin endpoint or cron job)
   */
  @Post('admin/cleanup-tokens')
  async cleanupTokens() {
    return this.authService.cleanupExpiredTokens();
  }
}
