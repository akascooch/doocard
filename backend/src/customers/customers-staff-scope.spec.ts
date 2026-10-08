import { ConflictException, NotFoundException } from '@nestjs/common';
import { CustomersService, PHONE_EXISTS_FA } from './customers.service';

describe('staff customer scope', () => {
  const prisma: any = {
    customer: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
    employee: { findUnique: jest.fn() },
    appointment: { findFirst: jest.fn() },
  };
  const service = new CustomersService(prisma, { handleNewCustomer: jest.fn() } as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.employee.findUnique.mockResolvedValue({ id: 7, isActive: true, userId: 50 });
  });

  it('hides another barber history and notes when access is only through one appointment', async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: 3,
      preferredEmployeeId: 9,
      notes: 'private note',
      user: { id: 1, name: 'ن', phone: '09120000000' },
      appointments: [
        { id: 1, employeeId: 7, deletedAt: null, notes: 'mine' },
        { id: 2, employeeId: 9, deletedAt: null, notes: 'theirs' },
      ],
    });

    const result = await service.findOne(3, { id: 50, role: 'EMPLOYEE' });

    expect(result.notes).toBeNull();
    expect(result.appointments).toEqual([
      expect.objectContaining({ id: 1, notes: 'mine' }),
    ]);
  });

  it('does not confirm another barber customer by phone', async () => {
    prisma.user.findUnique.mockResolvedValue({
      customer: {
        id: 3,
        preferredEmployeeId: 9,
        notes: 'secret',
        appointments: [],
      },
    });
    prisma.appointment.findFirst.mockResolvedValue(null);

    await expect(
      service.findByPhone('09120000000', { id: 50, role: 'EMPLOYEE' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns only phone-exists when linking a number owned by another barber', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 4,
      role: 'CUSTOMER',
      customer: { id: 3, preferredEmployeeId: 9 },
    });

    await expect(
      service.quickCreate(
        { name: 'جدید', phone: '09120000000' } as never,
        { id: 50, role: 'EMPLOYEE' },
      ),
    ).rejects.toEqual(expect.any(ConflictException));

    try {
      await service.quickCreate(
        { name: 'جدید', phone: '09120000000' } as never,
        { id: 50, role: 'EMPLOYEE' },
      );
    } catch (error) {
      const response = (error as ConflictException).getResponse() as { phoneExists?: boolean; message?: string };
      expect(response.phoneExists).toBe(true);
      expect(response.message).toBe(PHONE_EXISTS_FA);
      expect(JSON.stringify(response)).not.toContain('secret');
      expect(response).not.toHaveProperty('id');
    }
  });

  it('nulls notes on the staff list when the customer is only visible through an appointment', async () => {
    prisma.customer.findMany.mockResolvedValue([
      {
        id: 3,
        preferredEmployeeId: 9,
        notes: 'private',
        user: { id: 1, password: 'x', name: 'ن' },
        preferredEmployee: null,
        _count: { appointments: 1 },
      },
      {
        id: 4,
        preferredEmployeeId: 7,
        notes: 'own',
        user: { id: 2, password: 'x', name: 'م' },
        preferredEmployee: null,
        _count: { appointments: 0 },
      },
    ]);

    const rows = await service.findVisibleToStaff(7);

    expect(rows[0].notes).toBeNull();
    expect(rows[1].notes).toBe('own');
    expect(JSON.stringify(rows)).not.toContain('"password"');
  });
});
