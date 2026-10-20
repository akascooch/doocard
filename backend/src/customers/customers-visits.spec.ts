import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';

describe('customer visit history', () => {
  const prisma: any = {
    customer: { findUnique: jest.fn() },
    employee: { findUnique: jest.fn() },
    appointment: { count: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new CustomersService(prisma, { handleNewCustomer: jest.fn() } as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.employee.findUnique.mockResolvedValue({ id: 7, isActive: true, userId: 50 });
    prisma.$transaction.mockImplementation(async (ops: Array<Promise<unknown>>) => Promise.all(ops));
  });

  it('returns the hairdresser appointments for an owned customer, including a zero-history page', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 4, preferredEmployeeId: 7 });
    prisma.appointment.count.mockResolvedValue(1);
    prisma.appointment.findMany.mockResolvedValue([
      {
        id: 11,
        scheduledAt: new Date('2026-10-01T10:00:00.000Z'),
        paidAt: new Date('2026-10-01T11:00:00.000Z'),
        status: 'SETTLED',
        amount: 250000n,
        durationMin: 45,
        paymentMethod: 'CARD',
      },
    ]);

    const result = await service.listVisits(4, { id: 50, role: 'EMPLOYEE' }, { page: 1, pageSize: 20 });

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: 4, deletedAt: null, employeeId: 7 },
        take: 20,
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 11,
      status: 'SETTLED',
      amount: '250000',
      durationMin: 45,
      paymentMethod: 'CARD',
    });
  });

  it('does not confirm a customer owned by another hairdresser', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 4, preferredEmployeeId: 9 });

    await expect(
      service.listVisits(4, { id: 50, role: 'EMPLOYEE' }, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });

  it('does not let SERVICE read visit history', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 4, preferredEmployeeId: 7 });

    await expect(
      service.listVisits(4, { id: 50, role: 'SERVICE' }, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets ADMIN read the customer history without an ownership filter', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 4, preferredEmployeeId: 9 });
    prisma.appointment.count.mockResolvedValue(0);
    prisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.listVisits(4, { id: 1, role: 'ADMIN' }, {});

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: 4, deletedAt: null },
      }),
    );
    expect(result.items).toEqual([]);
  });
});
