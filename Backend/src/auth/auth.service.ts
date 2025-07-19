import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    console.log('🔍 Validating user:', { email });

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return null;
    }

    console.log('🔍 Finding user in database...');
    const user = await this.prisma.user.findFirst({
      where: {
        email: email,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        isActive: true,
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

  async login(loginDto: LoginDto) {
    console.log('🔵 Login attempt:', { email: loginDto.email });
    
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      console.log('❌ Login failed: Invalid credentials');
      throw new UnauthorizedException('ایمیل یا رمز عبور اشتباه است');
    }

    console.log('✅ Login successful:', { email: user.email, role: user.role });
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async register(registerDto: RegisterDto) {
    try {
      const hashedPassword = await bcrypt.hash(registerDto.password, 10);
      const user = await this.prisma.user.create({
        data: {
          email: registerDto.email,
          password: hashedPassword,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          phoneNumber: registerDto.phoneNumber,
          role: registerDto.role,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // لاگ مقدار role
      console.log('REGISTER ROLE:', registerDto.role);

      // ایجاد رکورد در جدول Customer یا Barber بر اساس نقش با هندل خطا
      try {
        if (registerDto.role === 'CUSTOMER') {
          await this.prisma.customer.create({
            data: {
              email: registerDto.email,
              firstName: registerDto.firstName,
              lastName: registerDto.lastName,
              phoneNumber: registerDto.phoneNumber,
              isActive: true,
              updatedAt: new Date(),
            },
          });
          console.log('Customer created for user:', registerDto.email);
        } else if (registerDto.role === 'BARBER' || registerDto.role === 'STAFF') {
          await this.prisma.barber.create({
            data: {
              email: registerDto.email,
              firstName: registerDto.firstName,
              lastName: registerDto.lastName,
              phoneNumber: registerDto.phoneNumber,
              isActive: true,
              updatedAt: new Date(),
            },
          });
          console.log('Barber created for user:', registerDto.email);
        }
      } catch (error) {
        console.error('Error inserting to customer/barber:', error);
      }

      return user;
    } catch (error) {
      if (error.code === 'P2002') {
        // خطای تکراری بودن ایمیل
        throw new ConflictException('ایمیل قبلاً ثبت شده است.');
      }
      throw error;
    }
  }
}
