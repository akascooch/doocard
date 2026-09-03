import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ServicesService', () => {
  let service: ServicesService;
  let prismaService: PrismaService;

  const mockService = {
    id: 1,
    name: 'Haircut',
    category: 'Hair',
    durationMinutes: 30,
    price: 50.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    service: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    appointmentService: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new service', async () => {
      const createServiceDto = {
        name: 'Haircut',
        category: 'Hair',
        durationMinutes: 30,
        price: 50.0,
      };

      mockPrismaService.service.create.mockResolvedValue(mockService);

      const result = await service.create(createServiceDto);

      expect(result).toEqual(mockService);
      expect(mockPrismaService.service.create).toHaveBeenCalledWith({
        data: {
          name: createServiceDto.name,
          description: createServiceDto.description,
          durationMinutes: createServiceDto.durationMinutes,
          price: createServiceDto.price,
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return all services', async () => {
      const mockServices = [mockService];
      mockPrismaService.service.findMany.mockResolvedValue(mockServices);

      const result = await service.findAll();

      expect(result).toEqual(mockServices);
      expect(mockPrismaService.service.findMany).toHaveBeenCalledWith({
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a service by id', async () => {
      mockPrismaService.service.findUnique.mockResolvedValue(mockService);

      const result = await service.findOne(1);

      expect(result).toEqual(mockService);
      expect(mockPrismaService.service.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should return null when service not found', async () => {
      mockPrismaService.service.findUnique.mockResolvedValue(null);

      const result = await service.findOne(999);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a service', async () => {
      const updateServiceDto = {
        name: 'Updated Haircut',
        category: 'Hair',
        durationMinutes: 45,
        price: 60.0,
      };

      const updatedService = { ...mockService, ...updateServiceDto };
      mockPrismaService.service.update.mockResolvedValue(updatedService);

      const result = await service.update(1, updateServiceDto);

      expect(result).toEqual(updatedService);
      expect(mockPrismaService.service.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          ...updateServiceDto,
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe('remove', () => {
    it('should delete a service', async () => {
      mockPrismaService.appointmentService.findMany.mockResolvedValue([]);
      mockPrismaService.service.delete.mockResolvedValue({ id: 1 });

      const result = await service.remove(1);

      expect(result).toEqual({ id: 1 });
      expect(mockPrismaService.service.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});