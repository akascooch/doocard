import { NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerRegistrationSmsService } from '../sms/customer-registration-sms.service';
import * as bcrypt from 'bcrypt';
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: PrismaService;

  const mockUser = {
    id: 1,
    name: 'John User',
    email: 'john@example.com',
    phone: '09123456789',
    password: 'hashedPassword',
    role: 'CUSTOMER',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    customer: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    employee: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockCustomerRegistrationSms = {
    handleNewCustomer: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    service = new UsersService(
      mockPrismaService as unknown as PrismaService,
      mockCustomerRegistrationSms as unknown as CustomerRegistrationSmsService,
    );
    prismaService = mockPrismaService as unknown as PrismaService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createUserDto = {
      name: 'John User',
      phone: '09123456789',
      email: 'john@example.com',
      password: 'password123',
      role: 'CUSTOMER',
    };

    it('should create user successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.customer.create.mockResolvedValue({ id: 1, userId: 1 });
      (bcrypt.hash as unknown as jest.Mock).mockResolvedValue('hashedPassword' as never);

      const result = await service.create(createUserDto);

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          name: createUserDto.name,
          phone: createUserDto.phone,
          email: createUserDto.email,
          password: 'hashedPassword',
          role: createUserDto.role,
          updatedAt: expect.any(Date),
        },
      });
      expect(mockPrismaService.customer.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ userId: mockUser.id }),
      }));
    });

    it('should create employee when role is EMPLOYEE', async () => {
      const employeeDto = { ...createUserDto, role: 'EMPLOYEE' };
      const employeeUser = { ...mockUser, role: 'EMPLOYEE' };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(employeeUser);
      mockPrismaService.employee.create.mockResolvedValue({ id: 1, userId: 1 });
      (bcrypt.hash as unknown as jest.Mock).mockResolvedValue('hashedPassword' as never);

      const result = await service.create(employeeDto);

      expect(result).toEqual(employeeUser);
      expect(mockPrismaService.employee.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ userId: employeeUser.id }),
      }));
    });

    it('should throw ConflictException when phone already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
    });

    it('should create user without email when not provided', async () => {
      const dtoWithoutEmail = { ...createUserDto };
      delete dtoWithoutEmail.email;

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.customer.create.mockResolvedValue({ id: 1, userId: 1 });
      (bcrypt.hash as unknown as jest.Mock).mockResolvedValue('hashedPassword' as never);

      const result = await service.create(dtoWithoutEmail);

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          name: dtoWithoutEmail.name,
          phone: dtoWithoutEmail.phone,
          email: undefined,
          password: 'hashedPassword',
          role: dtoWithoutEmail.role,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should use default role CUSTOMER when not provided', async () => {
      const dtoWithoutRole = { ...createUserDto };
      delete dtoWithoutRole.role;

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.customer.create.mockResolvedValue({ id: 1, userId: 1 });
      (bcrypt.hash as unknown as jest.Mock).mockResolvedValue('hashedPassword' as never);

      await service.create(dtoWithoutRole);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: 'CUSTOMER',
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const mockUsers = [mockUser];
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.findAll();

      expect(result).toEqual(mockUsers);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: 'desc' } }));
    });

    it('should return empty array when no users exist', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return user by id', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne(1);

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 } }));
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateUserDto = {
      name: 'John Updated',
      email: 'john.updated@example.com',
    };

    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, ...updateUserDto };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update(1, updateUserDto);

      expect(result).toEqual(updatedUser);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 } }));
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.update(999, updateUserDto)).rejects.toThrow(NotFoundException);
    });

    it('should update only provided fields', async () => {
      const partialUpdate = { name: 'New Name' };
      const updatedUser = { ...mockUser, name: 'New Name' };
      
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update(1, partialUpdate);

      expect(result.name).toBe('New Name');
      expect(result.email).toBe(mockUser.email);
    });
  });

  describe('remove', () => {
    it('should delete user successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.delete.mockResolvedValue(mockUser);

      const result = await service.remove(1);

      expect(result).toEqual({ message: 'کاربر با موفقیت حذف شد' });
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      const email = 'john@example.com';
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findByEmail(email);

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { email } }));
    });

    it('should return null when user not found by email', async () => {
      const email = 'nonexistent@example.com';
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.findByEmail(email);

      expect(result).toBeNull();
    });
  });

  describe('findByPhone', () => {
    it('should return user by phone', async () => {
      const phone = '09123456789';
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByPhone(phone);

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { phone } }));
    });

    it('should return null when user not found by phone', async () => {
      const phone = '09999999999';
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByPhone(phone);

      expect(result).toBeNull();
    });
  });

  /* describe('syncRole', () => { skipped: method not present in UsersService
  }); */

  /* describe('convertToEmployee', () => { skipped: method not present in UsersService
  }); */
});
