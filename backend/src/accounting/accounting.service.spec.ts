import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';

describe('AccountingService', () => {
  let service: AccountingService;

  const mockTransaction = {
    id: 1,
    amount: 50,
    type: 'INCOME',
    account: null,
    destinationAccount: null,
    category: null,
    createdByUser: null,
  };

  const mockPrismaService = {
    transaction: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    transactionCategory: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    appointment: {
      aggregate: jest.fn(),
    },
    employee: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: {} },
        { provide: NotificationsGateway, useValue: {} },
        { provide: PushNotificationsService, useValue: {} },
      ],
    }).compile();

    service = module.get<AccountingService>(AccountingService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns a paginated transaction list', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([mockTransaction]);
      mockPrismaService.transaction.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
          orderBy: { occurredAt: 'desc' },
        }),
      );
    });

    it('filters by transaction type', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.transaction.count.mockResolvedValue(0);

      await service.findAll({ type: 'INCOME' as any });

      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'INCOME', deletedAt: null }),
        }),
      );
    });

    it('filters by occurredAt range', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.transaction.count.mockResolvedValue(0);

      await service.findAll({ from: '2024-01-01', to: '2024-01-31' });

      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            occurredAt: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-01-31'),
            },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns a serialized transaction', async () => {
      mockPrismaService.transaction.findFirst.mockResolvedValue(mockTransaction);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.amount).toBe(50);
    });

    it('throws NotFoundException when missing', async () => {
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSummary', () => {
    it('returns income, expense, and net profit', async () => {
      mockPrismaService.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 1000 }, _count: 2 })
        .mockResolvedValueOnce({ _sum: { amount: 400 }, _count: 1 });
      mockPrismaService.appointment.aggregate
        .mockResolvedValueOnce({ _sum: { settlementDeductionAmount: 0 } })
        .mockResolvedValueOnce({
          _sum: { tipStaffShareRial: 0, tipSalonShareRial: 0, tipAmount: 0 },
        });

      const result = await service.getSummary();

      expect(result.totalIncome).toBe(1000);
      expect(result.totalExpense).toBe(400);
      expect(result.netProfit).toBe(600);
    });
  });

  describe('findAllCategories', () => {
    it('returns active categories ordered by name', async () => {
      const mockCategories = [
        { id: 1, name: 'Hair Services', type: 'INCOME' },
        { id: 2, name: 'Rent', type: 'EXPENSE' },
      ];
      mockPrismaService.transactionCategory.findMany.mockResolvedValue(mockCategories);

      const result = await service.findAllCategories();

      expect(result).toEqual(mockCategories);
      expect(mockPrismaService.transactionCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null, isActive: true }),
          orderBy: { name: 'asc' },
        }),
      );
    });
  });

  describe('createCategory', () => {
    it('creates a category', async () => {
      const dto = { name: 'New Category', type: 'INCOME' as const };
      const created = { id: 1, ...dto };
      mockPrismaService.transactionCategory.create.mockResolvedValue(created);

      const result = await service.createCategory(dto);

      expect(result).toEqual(created);
      expect(mockPrismaService.transactionCategory.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: dto }),
      );
    });
  });

  describe('updateCategory', () => {
    it('updates an existing category', async () => {
      const dto = { name: 'Updated Category' };
      mockPrismaService.transactionCategory.findFirst.mockResolvedValue({ id: 1, name: 'Old' });
      mockPrismaService.transactionCategory.update.mockResolvedValue({ id: 1, ...dto });

      const result = await service.updateCategory(1, dto as any);

      expect(result.name).toBe('Updated Category');
    });

    it('throws NotFoundException when category is missing', async () => {
      mockPrismaService.transactionCategory.findFirst.mockResolvedValue(null);

      await expect(service.updateCategory(999, { name: 'x' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeCategory', () => {
    it('soft-deletes a category with no transactions', async () => {
      mockPrismaService.transactionCategory.findFirst.mockResolvedValue({ id: 1, name: 'Rent' });
      mockPrismaService.transaction.count.mockResolvedValue(0);
      mockPrismaService.transactionCategory.update.mockResolvedValue({
        id: 1,
        deletedAt: new Date(),
      });

      await service.removeCategory(1);

      expect(mockPrismaService.transactionCategory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });

    it('rejects deleting a category that still has transactions', async () => {
      mockPrismaService.transactionCategory.findFirst.mockResolvedValue({ id: 1, name: 'Rent' });
      mockPrismaService.transaction.count.mockResolvedValue(3);

      await expect(service.removeCategory(1)).rejects.toThrow(BadRequestException);
    });
  });
});
