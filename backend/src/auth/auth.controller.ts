import { Controller, Post, Body, Res, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  getAccessCookieMaxAgeMs,
  getRefreshCookieMaxAgeMs,
} from './auth-token.config';
import { Response, Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    const secure = process.env.NODE_ENV === 'production';

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: getRefreshCookieMaxAgeMs(this.configService),
      path: '/',
    });

    res.cookie('token', accessToken, {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      maxAge: getAccessCookieMaxAgeMs(this.configService),
      path: '/',
    });
  }

  @Post('login')
  async login(
    @Body() loginDto: LoginDto, 
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.login(loginDto, ipAddress, userAgent);

    this.setAuthCookies(res, result.access_token, result.refresh_token);
    
    console.log('✅ Login successful, tokens set in cookies');
    
    return { 
      user: result.user,
      access_token: result.access_token,
    };
  }

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

    this.setAuthCookies(res, result.access_token, result.refresh_token);
    
    console.log('✅ Token refreshed successfully');
    
    return { 
      access_token: result.access_token,
      user: result.user,
    };
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const refreshToken = req.cookies?.refresh_token;
    
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    
    res.clearCookie('refresh_token', { path: '/' });
    res.clearCookie('token', { path: '/' });
    
    console.log('✅ Logout successful');
    
    return { 
      success: true,
      message: 'با موفقیت خارج شدید',
    };
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('admin/cleanup-tokens')
  async cleanupTokens() {
    return this.authService.cleanupExpiredTokens();
  }
}
