import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    phone: '09123456789',
    password: 'hashedPassword',
    role: 'CUSTOMER',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    customer: {
      create: jest.fn(),
    },
    employee: {
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user data when credentials are valid', async () => {
      const identifier = 'test@example.com';
      const password = 'password123';

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(true as never);

      const result = await service.validateUser(identifier, password);

      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        phone: mockUser.phone,
        role: mockUser.role,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: identifier },
        select: expect.any(Object),
      });
    });

    it('should return null when user is not found', async () => {
      const identifier = 'nonexistent@example.com';
      const password = 'password123';

      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.validateUser(identifier, password);

      expect(result).toBeNull();
    });

    it('should return null when password is incorrect', async () => {
      const identifier = 'test@example.com';
      const password = 'wrongpassword';

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(false as never);

      const result = await service.validateUser(identifier, password);

      expect(result).toBeNull();
    });

    it('should handle phone number as identifier', async () => {
      const identifier = '09123456789';
      const password = 'password123';

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(true as never);

      const result = await service.validateUser(identifier, password);

      expect(result).toBeDefined();
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { phone: identifier },
        select: expect.any(Object),
      });
    });
  });

  describe('login', () => {
    it('should return access token and user data on successful login', async () => {
      const loginDto = {
        identifier: 'test@example.com',
        password: 'password123',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(true as never);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.login(loginDto);

      expect(result).toEqual({
        access_token: 'mock-jwt-token',
        user: {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          phone: mockUser.phone,
          role: mockUser.role,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        },
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        email: mockUser.email,
        phone: mockUser.phone,
        sub: mockUser.id,
        role: mockUser.role,
      });
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      const loginDto = {
        identifier: 'test@example.com',
        password: 'wrongpassword',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(false as never);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when identifier is missing', async () => {
      const loginDto = {
        identifier: '',
        password: 'password123',
      };

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    const registerDto = {
      name: 'New User',
      email: 'newuser@example.com',
      phone: '09987654321',
      password: 'password123',
      role: 'CUSTOMER',
      birthdate: '1990-01-01',
      notes: 'Test customer',
    };

    it('should successfully register a new customer', async () => {
      (bcrypt.hash as unknown as jest.Mock).mockResolvedValue('hashed');
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.customer.create.mockResolvedValue({ id: 1, userId: 1 });

      const result = await service.register(registerDto);

      expect(result).toEqual({
        message: 'ثبت نام با موفقیت انجام شد',
        user: mockUser,
      });
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          name: registerDto.name,
          phone: registerDto.phone,
          email: registerDto.email,
          password: expect.any(String),
          role: registerDto.role,
        },
        select: expect.any(Object),
      });
      expect(mockPrismaService.customer.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          birthdate: new Date(registerDto.birthdate),
          notes: registerDto.notes,
        },
      });
    });

    it('should successfully register a new employee', async () => {
      (bcrypt.hash as unknown as jest.Mock).mockResolvedValue('hashed');
      const employeeRegisterDto = {
        ...registerDto,
        role: 'EMPLOYEE',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        ...mockUser,
        role: 'EMPLOYEE',
      });
      mockPrismaService.employee.create.mockResolvedValue({ id: 1, userId: 1 });

      const result = await service.register(employeeRegisterDto);

      expect(result.user.role).toBe('EMPLOYEE');
      expect(mockPrismaService.employee.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          specialty: 'General',
          baseSalary: 0,
          commissionRate: 0,
        },
      });
    });

    it('should throw ConflictException when user already exists', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should rollback user creation if profile creation fails', async () => {
      (bcrypt.hash as unknown as jest.Mock).mockResolvedValue('hashed');
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.customer.create.mockRejectedValue(new Error('Profile creation failed'));
      mockPrismaService.user.delete.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow('خطا در ایجاد پروفایل کاربر');
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({ where: { id: mockUser.id } });
    });
  });
});
