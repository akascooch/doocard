import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DayClosingService } from './day-closing.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DayClosingService', () => {
  let service: DayClosingService;
  let prismaService: PrismaService;

  const mockDayClosing = {
    id: 1,
    date: new Date('2024-01-01'),
    totalIncome: 1000,
    totalExpense: 200,
    totalTips: 50,
    totalSalaries: 300,
    isClosed: true,
    closedAt: new Date('2024-01-01T18:00:00Z'),
    closedBy: 1,
  };

  const mockPrismaService: any = {
    dayClosing: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    appointment: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    tip: {
      aggregate: jest.fn(),
    },
    salary: {
      aggregate: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DayClosingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DayClosingService>(DayClosingService);
    prismaService = module.get<PrismaService>(PrismaService) as any;
    (prismaService.transaction.findMany as any).mockResolvedValue([]);
    (prismaService.appointment.findMany as any).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDayClosing', () => {
    it('should return day closing data for a specific date', async () => {
      mockPrismaService.dayClosing.findUnique.mockResolvedValue(mockDayClosing);

      const result = await service.getDayClosing(new Date('2024-01-01'));

      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('isClosed', true);
      expect(result).toHaveProperty('totalIncome');
      expect(result).toHaveProperty('totalExpense');
      expect(mockPrismaService.dayClosing.findUnique).toHaveBeenCalledWith({
        where: {
          date: expect.any(Date),
        },
        include: { closedByUser: true }
      });
    });

    it('should create new day closing record if not found', async () => {
      mockPrismaService.dayClosing.findUnique.mockResolvedValue(null);
      mockPrismaService.dayClosing.create.mockResolvedValue(mockDayClosing);

      const result = await service.getDayClosing(new Date('2024-01-01'));

      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('isClosed', true);
      expect(mockPrismaService.dayClosing.create).toHaveBeenCalled();
    });
  });

  describe('closeDay', () => {
    it('should close a day successfully', async () => {
      const date = new Date('2024-01-01');
      const closedBy = 1;

      mockPrismaService.dayClosing.findUnique.mockResolvedValue(null);
      mockPrismaService.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 1000 } }) // Income
        .mockResolvedValueOnce({ _sum: { amount: 200 } }); // Expenses
      mockPrismaService.appointment.count = jest.fn().mockResolvedValue(5);
      mockPrismaService.dayClosing.upsert = jest.fn().mockResolvedValue(mockDayClosing);
      mockPrismaService.dayClosing.create.mockResolvedValue(mockDayClosing);

      const result = await service.closeDay(date, closedBy);

      expect(result).toEqual(mockDayClosing);
      expect(mockPrismaService.dayClosing.upsert).toHaveBeenCalled();
    });

    it('should throw error when day is already closed', async () => {
      const date = new Date('2024-01-01');
      const closedBy = 1;

      mockPrismaService.dayClosing.findUnique.mockResolvedValue({ ...mockDayClosing, isClosed: true });

      await expect(service.closeDay(date, closedBy)).rejects.toThrow('این روز قبلاً بسته شده است');
    });
  });

  describe('reopenDay', () => {
    it('should reopen a closed day', async () => {
      const date = new Date('2024-01-01');
      const reopenedBy = 1;

      mockPrismaService.dayClosing.findUnique.mockResolvedValue(mockDayClosing);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: reopenedBy, role: 'ADMIN' });
      mockPrismaService.dayClosing.update.mockResolvedValue({
        ...mockDayClosing,
        isClosed: false,
        closedAt: null,
        closedBy: null,
      });

      const result = await service.reopenDay(date, reopenedBy);

      expect(result.isClosed).toBe(false);
      expect(mockPrismaService.dayClosing.update).toHaveBeenCalled();
    });

    it('should throw error when day is not closed', async () => {
      const date = new Date('2024-01-01');
      const reopenedBy = 1;

      mockPrismaService.dayClosing.findUnique.mockResolvedValue({
        ...mockDayClosing,
        isClosed: false,
      });

      await expect(service.reopenDay(date, reopenedBy)).rejects.toThrow('این روز قبلاً باز است');
    });
  });

  describe('getDayClosingHistory', () => {
    it('should return day closing history', async () => {
      const mockHistory = [mockDayClosing];
      mockPrismaService.dayClosing.findMany.mockResolvedValue(mockHistory);

      const result = await service.getDayClosingHistory();

      expect(result).toEqual(mockHistory);
      expect(mockPrismaService.dayClosing.findMany).toHaveBeenCalledWith({
        orderBy: {
          date: 'desc',
        },
        take: 30,
        include: {
          closedByUser: true,
        },
      });
    });
  });
});