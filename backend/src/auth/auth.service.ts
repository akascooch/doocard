import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  getJwtAccessExpiresIn,
  getRefreshCookieMaxAgeMs,
  getRefreshTokenExpiresAt,
  getRememberMeCookieMaxAgeMs,
  getRememberMeRefreshExpiresAt,
  shouldApplyRememberMe,
} from './auth-token.config';
import { CustomerRegistrationSmsService } from '../sms/customer-registration-sms.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly customerRegistrationSms: CustomerRegistrationSmsService,
  ) {}

  async validateUser(identifier: string, password: string): Promise<any> {
    console.log('🔍 Validating user');
    
    if (!identifier || !password) {
      console.log('❌ Missing identifier or password');
      return null;
    }

    console.log('🔍 Finding user in database...');
    
    // Check if identifier is email or phone number
    const isEmail = identifier.includes('@');
    
    const user = await this.prisma.user.findFirst({
      where: {
        ...(isEmail ? { email: identifier } : { phone: identifier }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      console.log('❌ User not found');
      return null;
    }

    console.log('✅ User found:', { 
      id: user.id, 
      role: user.role
    });

    console.log('🔍 Comparing passwords...');
    // Do not log passwordMatch boolean in production logs (timing/info leak risk)
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  /**
   * Generate access token (TTL from JWT_EXPIRES_IN, default 24h).
   */
  private generateAccessToken(user: any): string {
    const payload = { 
      email: user.email, 
      phone: user.phone,
      sub: user.id, 
      role: user.role 
    };
    
    return this.jwtService.sign(payload, {
      expiresIn: getJwtAccessExpiresIn(this.configService),
    });
  }

  /**
   * Generate refresh token (TTL from JWT_REFRESH_EXPIRES_IN, or explicit expiresAt).
   */
  private async generateRefreshToken(
    userId: number,
    ipAddress?: string,
    userAgent?: string,
    expiresAt?: Date,
  ): Promise<string> {
    const token = randomBytes(64).toString('hex');
    const expiry = expiresAt ?? getRefreshTokenExpiresAt(this.configService);

    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt: expiry,
        ipAddress,
        userAgent,
      },
    });

    return token;
  }

  /**
   * Issue access + refresh tokens (password login and OTP verify).
   */
  async issueSession(
    user: {
      id: number;
      role: string;
      email?: string | null;
      phone?: string | null;
      name?: string | null;
    },
    ipAddress?: string,
    userAgent?: string,
    rememberMe?: boolean,
  ) {
    const applyRemember = shouldApplyRememberMe(user.role, rememberMe);
    const refreshExpiresAt = applyRemember
      ? getRememberMeRefreshExpiresAt()
      : getRefreshTokenExpiresAt(this.configService);
    const refreshCookieMaxAgeMs = applyRemember
      ? getRememberMeCookieMaxAgeMs()
      : getRefreshCookieMaxAgeMs(this.configService);

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(
      user.id,
      ipAddress,
      userAgent,
      refreshExpiresAt,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user,
      refreshCookieMaxAgeMs,
    };
  }

  /**
   * Login with refresh token generation
   */
  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    console.log('🔵 Login attempt');
    
    if (!loginDto.identifier) {
      throw new UnauthorizedException('ایمیل یا شماره موبایل الزامی است');
    }
    
    const user = await this.validateUser(loginDto.identifier, loginDto.password);
    if (!user) {
      console.log('❌ Login failed: Invalid credentials');
      throw new UnauthorizedException('ایمیل/شماره موبایل یا رمز عبور اشتباه است');
    }

    console.log('✅ Login successful:', { 
      userId: user.id, 
      role: user.role 
    });
    
    const result = await this.issueSession(user, ipAddress, userAgent, loginDto.rememberMe);
    
    return result;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string, ipAddress?: string, userAgent?: string) {
    // Find refresh token in database
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    // Validate token
    if (!storedToken) {
      throw new UnauthorizedException('رفرش توکن معتبر نیست');
    }

    if (storedToken.isRevoked) {
      throw new UnauthorizedException('رفرش توکن لغو شده است');
    }

    if (storedToken.expiresAt < new Date()) {
      // Token expired - delete it
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      throw new UnauthorizedException('رفرش توکن منقضی شده است');
    }

    const { password, ...user } = storedToken.user;
    const accessToken = this.generateAccessToken(user);
    const newRefreshToken = await this.generateRefreshToken(
      user.id,
      ipAddress,
      userAgent,
      storedToken.expiresAt,
    );
    const remainingMs = Math.max(storedToken.expiresAt.getTime() - Date.now(), 60_000);

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    return {
      access_token: accessToken,
      refresh_token: newRefreshToken,
      user,
      refreshCookieMaxAgeMs: remainingMs,
    };
  }

  /**
   * Logout - revoke refresh token
   */
  async logout(refreshToken: string) {
    if (!refreshToken) {
      return { success: true };
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (storedToken) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { 
          isRevoked: true,
          revokedAt: new Date(),
        },
      });
    }

    return { success: true };
  }

  /**
   * Cleanup expired refresh tokens (run periodically)
   */
  async cleanupExpiredTokens() {
    const deleted = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true, revokedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }, // Older than 7 days
        ],
      },
    });

    console.log(`🧹 Cleaned up ${deleted.count} expired refresh tokens`);
    return deleted;
  }

  async register(registerDto: RegisterDto) {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { phone: registerDto.phone },
            ...(registerDto.email ? [{ email: registerDto.email }] : []),
          ],
        },
      });

      if (existingUser) {
        throw new ConflictException('کاربر با این شماره تلفن یا ایمیل قبلاً ثبت نام کرده است');
      }

      const hashedPassword = await bcrypt.hash(registerDto.password, 12);

      // Use transaction to ensure both user and profile are created together
      let registeredPreferredEmployeeId: number | null = null;
      const result = await this.prisma.$transaction(async (tx) => {
        // Create user
        const user = await tx.user.create({
        data: {
          name: registerDto.name,
          phone: registerDto.phone,
          email: registerDto.email,
          password: hashedPassword,
          role: registerDto.role as any,
        },
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

      console.log('User registered:', { id: user.id, role: registerDto.role });

      // Create profile based on role
        if (registerDto.role === 'CUSTOMER') {
          // Resolve preferred employee
          let resolvedEmployeeId: number | null = null;
          if (registerDto.preferredEmployeeId) {
            const employee = await tx.employee.findUnique({ where: { id: registerDto.preferredEmployeeId } });
            resolvedEmployeeId = employee ? employee.id : null;
          }
          if (!resolvedEmployeeId) {
            const defaultEmployee = await tx.employee.findFirst({ where: { isDefault: true, isActive: true } });
            if (defaultEmployee) {
              resolvedEmployeeId = defaultEmployee.id;
            } else {
              const firstEmployee = await tx.employee.findFirst({ where: { isActive: true } });
              if (firstEmployee) {
                resolvedEmployeeId = firstEmployee.id;
              }
            }
          }

          registeredPreferredEmployeeId = resolvedEmployeeId;
          console.log('Creating customer profile with employeeId:', resolvedEmployeeId);
          await tx.customer.create({
            data: {
              userId: user.id,
              preferredEmployeeId: resolvedEmployeeId,
            },
          });
        } else if (registerDto.role === 'EMPLOYEE') {
          await tx.employee.create({
            data: {
              userId: user.id,
            },
          });
        }

        return user;
      });

      if (registerDto.role === 'CUSTOMER') {
        try {
          await this.customerRegistrationSms.handleNewCustomer({
            name: result.name || registerDto.name,
            phone: result.phone || registerDto.phone,
            userId: result.id,
            source: 'self_register',
            preferredEmployeeId: registeredPreferredEmployeeId,
          });
        } catch (err: any) {
          this.logger.error(
            '[CustomerRegistration SMS error] ' + (err?.message || 'unknown'),
          );
        }
      }

      return { user: result, message: 'کاربر با موفقیت ثبت‌نام شد' };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }
}
