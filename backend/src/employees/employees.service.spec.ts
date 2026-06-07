import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prismaService: PrismaService;

  const mockEmployee = {
    id: 1,
    userId: 1,
    specialty: 'Hair Stylist',
    baseSalary: 5000,
    commissionRate: 0.1,
    isDefault: false,
    isActive: true,
    user: {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      phone: '09123456789',
      role: 'EMPLOYEE',
    },
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    employee: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    employeeService: {
      findMany: jest.fn(),
      createMany: jest.fn(),
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
        EmployeesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
    prismaService = module.get<PrismaService>(PrismaService);
    // ensure delete exists on user delegate
    // @ts-ignore
    prismaService.user.delete = prismaService.user.delete || jest.fn();
    // mock $transaction to directly execute callback with tx containing needed delegates
    // @ts-ignore
    prismaService.$transaction = jest.fn(async (cb: any) => cb({
      ...prismaService,
      user: prismaService.user,
      employee: prismaService.employee,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new employee', async () => {
    const createEmployeeDto = {
        name: 'John Doe',
      phone: '09123456789',
      email: 'john@example.com',
      password: 'password123',
      specialty: 'Hair Stylist',
        baseSalary: 5000,
      commissionRate: 0.1,
    };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ id: 1, ...createEmployeeDto });
      mockPrismaService.employee.create.mockResolvedValue(mockEmployee);

      const result = await service.create(createEmployeeDto);

      expect(result).toEqual(mockEmployee);
      expect(mockPrismaService.user.create).toHaveBeenCalled();
      expect(mockPrismaService.employee.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when user already exists', async () => {
      const createEmployeeDto = {
        name: 'John Doe',
        phone: '09123456789',
        email: 'john@example.com',
        password: 'password123',
        specialty: 'Hair Stylist',
        baseSalary: 5000,
        commissionRate: 0.1,
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 1 });

      await expect(service.create(createEmployeeDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return canonical list items with flattened name and services', async () => {
      const mockEmployees = [
        {
          ...mockEmployee,
          isDefault: false,
          isActive: true,
          employeeServices: [
            {
              id: 1,
              serviceId: 1,
              service: { id: 1, name: 'Haircut', description: null, price: 100000, durationMinutes: 30 },
            },
          ],
        },
      ];
      mockPrismaService.employee.findMany.mockResolvedValue(mockEmployees);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John Doe');
      expect(result[0].phone).toBe('09123456789');
      expect(result[0].services).toHaveLength(1);
      expect(result[0].services[0].name).toBe('Haircut');
      expect(mockPrismaService.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: expect.any(Object) }),
      );
    });
  });

  describe('findOne', () => {
    it('should return an employee by id', async () => {
      const mockEmployeeWithRelations = {
        ...mockEmployee,
        appointments: [],
        salaries: [],
        tips: [],
      };
      mockPrismaService.employee.findUnique.mockResolvedValue(mockEmployeeWithRelations);

      const result = await service.findOne(1);

      expect(result).toEqual(mockEmployeeWithRelations);
      expect(mockPrismaService.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          user: true,
          appointments: {
            include: {
              customer: {
                include: { user: true }
              },
              service: true
            },
            orderBy: {
              scheduledAt: 'desc'
            }
          },
          salaries: {
            orderBy: {
              createdAt: 'desc'
            }
          },
          tips: {
            include: {
              appointment: {
                include: {
                  customer: {
                    include: { user: true }
                  },
                  service: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        },
      });
    });

    it('should throw NotFoundException when employee not found', async () => {
      mockPrismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an employee', async () => {
    const updateEmployeeDto = {
      specialty: 'Senior Hair Stylist',
        baseSalary: 6000,
      commissionRate: 0.15,
    };

      const updatedEmployee = { ...mockEmployee, ...updateEmployeeDto };
      mockPrismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      mockPrismaService.employee.update.mockResolvedValue(updatedEmployee);

      const result = await service.update(1, updateEmployeeDto);

      expect(result).toEqual(updatedEmployee);
      expect(mockPrismaService.employee.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 1 },
        data: updateEmployeeDto,
      }));
    });

    it('should throw NotFoundException when employee not found', async () => {
      const updateEmployeeDto = {
        specialty: 'Senior Hair Stylist',
        baseSalary: 6000,
        commissionRate: 0.15,
      };

      mockPrismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.update(999, updateEmployeeDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete an employee', async () => {
      mockPrismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      mockPrismaService.employee.delete.mockResolvedValue(mockEmployee);

      const result = await service.remove(1);

      expect(result).toEqual({ message: 'Employee deleted successfully' });
      expect(mockPrismaService.employee.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException when employee not found', async () => {
      mockPrismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});