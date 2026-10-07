import {
  buildReferenceIndexes,
  commitEligibleAppointmentRows,
  ensureCustomer,
  PHONE_COLLISION_STAFF_ACCOUNT,
  StaffPhoneCollisionError,
} from './appointment-commit.lib';

describe('appointment import staff phone collision', () => {
  it('does not create a customer profile for a staff-owned phone', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 9,
          role: 'ADMIN',
          phone: '09120000009',
          customer: null,
        }),
        create: jest.fn(),
      },
      customer: { create: jest.fn() },
    };

    await expect(
      ensureCustomer(tx as never, '09120000009', 'Someone', new Map()),
    ).rejects.toBeInstanceOf(StaffPhoneCollisionError);
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.customer.create).not.toHaveBeenCalled();
  });

  it('does not index a staff user who already has a customer row', async () => {
    const prisma = {
      employee: { findMany: jest.fn().mockResolvedValue([]) },
      customer: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 3,
            user: { id: 9, name: 'Admin', phone: '09120000009', role: 'ADMIN' },
          },
        ]),
      },
      service: { findMany: jest.fn().mockResolvedValue([]) },
      calendarDate: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) },
      bankAccount: { findFirst: jest.fn().mockResolvedValue({ id: 2 }) },
    };

    const indexes = await buildReferenceIndexes(prisma as never);

    expect(indexes.customersByPhone.has('09120000009')).toBe(false);
  });

  it('fails that import row and records the collision reason', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 9,
          role: 'EMPLOYEE',
          phone: '09120000008',
          customer: { id: 4 },
        }),
        create: jest.fn(),
      },
      customer: { create: jest.fn() },
      appointment: { create: jest.fn() },
    };
    const prisma = {
      employee: { findMany: jest.fn().mockResolvedValue([]) },
      customer: { findMany: jest.fn().mockResolvedValue([]) },
      service: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, name: 'اصلاح', durationMinutes: 30 },
        ]),
      },
      calendarDate: {
        findMany: jest.fn().mockResolvedValue([{ id: 6, jalaliDate: '1403-01-01' }]),
      },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) },
      bankAccount: { findFirst: jest.fn().mockResolvedValue({ id: 2 }) },
      appointment: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
    };

    const result = await commitEligibleAppointmentRows(
      prisma as never,
      'batch-1',
      [
        {
          sourceFile: 'a.xlsx',
          rowNumber: 2,
          jalaliDateRaw: '1403/01/01',
          jalaliDateKey: '1403-01-01',
          customerPhone: '09120000008',
          customerName: 'Wrong',
          employeeShareRial: 0n,
          sharePercent: null,
          employeeName: 'Barber',
          employeePhone: '09120000007',
          totalPriceRial: 1000n,
          serviceNameRaw: 'اصلاح',
          serviceNameCanonical: 'اصلاح',
        },
      ],
      { createMissing: false, createIncomeTx: false },
    );

    expect(result.failed).toBe(1);
    expect(result.created).toBe(0);
    expect(result.failureReasons).toEqual([PHONE_COLLISION_STAFF_ACCOUNT]);
    expect(tx.customer.create).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.appointment.create).not.toHaveBeenCalled();
  });
});
