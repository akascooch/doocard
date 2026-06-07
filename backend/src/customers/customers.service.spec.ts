import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CustomersService', () => {
  let service: CustomersService;
  let prismaService: PrismaService;

  const mockCustomer = {
    id: 1,
    userId: 1,
    birthdate: new Date('1990-01-01'),
    notes: 'VIP Customer',
    user: {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      phone: '09123456789',
      role: 'CUSTOMER',
    },
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    customer: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    appointment: {
      count: jest.fn(),
    },
    transaction: {
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
    prismaService = module.get<PrismaService>(PrismaService);
    // ensure delete exists on user delegate
    // @ts-ignore
    prismaService.user.delete = prismaService.user.delete || jest.fn();
    // @ts-ignore
    prismaService.$transaction = jest.fn(async (cb: any) => cb({
      ...prismaService,
      user: prismaService.user,
      customer: prismaService.customer,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new customer', async () => {
      const createCustomerDto = {
        name: 'John Doe',
        phone: '09123456789',
        email: 'john@example.com',
        password: 'password123',
        birthdate: '1990-01-01',
        notes: 'VIP Customer',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ id: 1, ...createCustomerDto });
      mockPrismaService.customer.create.mockResolvedValue(mockCustomer);

      const result = await service.create(createCustomerDto);

      expect(result).toEqual(mockCustomer);
      expect(mockPrismaService.user.create).toHaveBeenCalled();
      expect(mockPrismaService.customer.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when user already exists', async () => {
      const createCustomerDto = {
        name: 'John Doe',
        phone: '09123456789',
        email: 'john@example.com',
        password: 'password123',
        birthdate: '1990-01-01',
        notes: 'VIP Customer',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 1 });

      await expect(service.create(createCustomerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all customers', async () => {
      const mockCustomers = [mockCustomer];
      mockPrismaService.customer.findMany.mockResolvedValue(mockCustomers);

      const result = await service.findAll();

      expect(result).toEqual(mockCustomers);
      expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith({
        include: {
          user: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a customer by id', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomer);

      const result = await service.findOne(1);

      expect(result).toEqual(mockCustomer);
      expect(mockPrismaService.customer.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          user: true,
          appointments: {
            include: {
              employee: {
                include: {
                  user: true,
                },
              },
              service: true,
            },
            orderBy: {
              scheduledAt: 'desc',
            },
          },
        },
      });
    });

    it('should throw NotFoundException when customer not found', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByPhone', () => {
    it('should return a customer by phone', async () => {
      const phone = '09123456789';
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 1,
        customer: mockCustomer,
      });

      const result = await service.findByPhone(phone);

      expect(result).toEqual(mockCustomer);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { phone: phone },
        include: {
          customer: {
            include: {
              appointments: {
                include: {
                  employee: {
                    include: { user: true }
                  },
                  service: true
                },
                orderBy: {
                  scheduledAt: 'desc'
                }
              }
            }
          }
        }
      });
    });

    it('should throw NotFoundException when customer not found', async () => {
      const phone = '09999999999';
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findByPhone(phone)).rejects.toThrow('Customer not found');
    });
  });

  describe('update', () => {
    it('should update a customer', async () => {
      const updateCustomerDto = {
        notes: 'Updated VIP Customer',
        birthdate: '1990-01-01',
      };

      const updatedCustomer = { ...mockCustomer, ...updateCustomerDto };
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      mockPrismaService.customer.update.mockResolvedValue(updatedCustomer);

      const result = await service.update(1, updateCustomerDto);

      expect(result).toEqual(updatedCustomer);
      expect(mockPrismaService.customer.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 1 },
        include: { user: true },
      }));
    });

    it('should throw NotFoundException when customer not found', async () => {
      const updateCustomerDto = {
        notes: 'Updated VIP Customer',
        birthdate: '1990-01-01',
      };

      mockPrismaService.customer.findUnique.mockResolvedValue(null);

      await expect(service.update(999, updateCustomerDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a customer', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      mockPrismaService.customer.delete.mockResolvedValue(mockCustomer);

      const result = await service.remove(1);

      expect(result).toEqual({ message: 'Customer deleted successfully' });
      expect(mockPrismaService.customer.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException when customer not found', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});