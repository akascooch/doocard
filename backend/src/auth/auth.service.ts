import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(identifier: string, password: string): Promise<any> {
    console.log('🔍 Validating user:', { identifier });

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
      email: user.email,
      phone: user.phone,
      role: user.role
    });

    console.log('🔍 Comparing passwords...');
    const passwordMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', passwordMatch);

    if (passwordMatch) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  /**
   * Generate access token (short-lived: 15 minutes)
   */
  private generateAccessToken(user: any): string {
    const payload = { 
      email: user.email, 
      phone: user.phone,
      sub: user.id, 
      role: user.role 
    };
    
    return this.jwtService.sign(payload, {
      expiresIn: '15m', // 15 minutes
    });
  }

  /**
   * Generate refresh token (long-lived: 30 days)
   */
  private async generateRefreshToken(
    userId: number, 
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    // Generate cryptographically secure random token
    const token = randomBytes(64).toString('hex');
    
    // Calculate expiration date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Store in database
    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    return token;
  }

  /**
   * Login with refresh token generation
   */
  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    console.log('🔵 Login attempt:', { identifier: loginDto.identifier });
    
    if (!loginDto.identifier) {
      throw new UnauthorizedException('ایمیل یا شماره موبایل الزامی است');
    }
    
    const user = await this.validateUser(loginDto.identifier, loginDto.password);
    if (!user) {
      console.log('❌ Login failed: Invalid credentials');
      throw new UnauthorizedException('ایمیل/شماره موبایل یا رمز عبور اشتباه است');
    }

    console.log('✅ Login successful:', { 
      email: user.email, 
      phone: user.phone,
      role: user.role 
    });
    
    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id, ipAddress, userAgent);
    
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user,
    };
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

    // Generate new access token
    const { password, ...user } = storedToken.user;
    const accessToken = this.generateAccessToken(user);

    // Optionally: Rotate refresh token (generate new one and revoke old)
    // This is more secure but requires updating the cookie
    const newRefreshToken = await this.generateRefreshToken(user.id, ipAddress, userAgent);
    
    // Revoke old refresh token
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

      return { user: result, message: 'کاربر با موفقیت ثبت‌نام شد' };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }
}
