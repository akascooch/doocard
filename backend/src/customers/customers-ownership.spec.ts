import { NotFoundException } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

describe('customer record ownership', () => {
  const service = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const prisma = {
    customer: { findUnique: jest.fn() },
    employee: { findUnique: jest.fn() },
  };

  let controller: CustomersController;

  beforeEach(() => {
    jest.clearAllMocks();
    service.findOne.mockResolvedValue({ id: 55, userId: 10 });
    service.update.mockResolvedValue({ id: 55, userId: 10 });
    controller = new CustomersController(service as never, prisma as never);
  });

  it('lets a customer read their own row when the primary key differs from the user id', async () => {
    prisma.customer.findUnique.mockResolvedValue({ userId: 10 });

    await controller.findOne(55, { user: { id: 10, role: 'CUSTOMER' } });

    expect(service.findOne).toHaveBeenCalledWith(55, { id: 10, role: 'CUSTOMER' });
  });

  it('hides an existing foreign customer row the same way as a missing row', async () => {
    prisma.customer.findUnique.mockResolvedValueOnce({ userId: 99 }).mockResolvedValueOnce(null);

    const existing = await controller
      .findOne(10, { user: { id: 10, role: 'CUSTOMER' } })
      .catch((error: unknown) => error);
    const missing = await controller
      .findOne(55, { user: { id: 10, role: 'CUSTOMER' } })
      .catch((error: unknown) => error);

    expect(existing).toBeInstanceOf(NotFoundException);
    expect(missing).toBeInstanceOf(NotFoundException);
    expect((existing as NotFoundException).getStatus()).toBe((missing as NotFoundException).getStatus());
    expect((existing as NotFoundException).getResponse()).toEqual(
      (missing as NotFoundException).getResponse(),
    );
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it('rejects a customer update of another customer id', async () => {
    prisma.customer.findUnique.mockResolvedValue({ userId: 20 });

    await expect(
      controller.update(55, { notes: 'x' } as never, { user: { id: 10, role: 'CUSTOMER' } }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(service.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the customer row does not exist', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(
      controller.findOne(55, { user: { id: 10, role: 'CUSTOMER' } }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('still lets staff look up a customer by primary key', async () => {
    await controller.findOne(55, { user: { id: 1, role: 'ADMIN' } });

    expect(prisma.customer.findUnique).not.toHaveBeenCalled();
    expect(service.findOne).toHaveBeenCalledWith(55, { id: 1, role: 'ADMIN' });
  });

  it('ignores a forged userId when a customer updates their own row', async () => {
    prisma.customer.findUnique.mockResolvedValue({ userId: 10 });

    await controller.update(
      55,
      { notes: 'ok', userId: 999, customerId: 77 } as never,
      { user: { id: 10, role: 'CUSTOMER' } },
    );

    expect(service.update).toHaveBeenCalledWith(
      55,
      expect.objectContaining({ notes: 'ok' }),
      { id: 10, role: 'CUSTOMER' },
    );
    const dto = service.update.mock.calls[0][1] as { userId?: unknown; customerId?: unknown };
    expect(dto.userId).toBeUndefined();
    expect(dto.customerId).toBeUndefined();
  });
});

describe('CustomersService customer update ownership', () => {
  const prisma = {
    customer: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn(), update: jest.fn() },
    employee: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  let service: CustomersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CustomersService(prisma as never, { send: jest.fn() } as never);
  });

  it('does not write when a customer mutates another customer row', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 55, userId: 20, user: { phone: '09120000000' } });

    await expect(
      service.update(55, { notes: 'x' } as never, { id: 10, role: 'CUSTOMER' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not write a forged userId onto the owned customer', async () => {
    const tx = {
      user: { update: jest.fn() },
      customer: { update: jest.fn().mockResolvedValue({ id: 55, userId: 10 }) },
    };
    prisma.customer.findUnique.mockResolvedValue({
      id: 55,
      userId: 10,
      user: { phone: '09120000000' },
    });
    prisma.$transaction.mockImplementation(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx));

    await service.update(
      55,
      { notes: 'ok', userId: 999, customerId: 77, preferredEmployeeId: 3 } as never,
      { id: 10, role: 'CUSTOMER' },
    );

    expect(tx.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 55 },
        data: expect.objectContaining({ notes: 'ok' }),
      }),
    );
    const data = tx.customer.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.userId).toBeUndefined();
    expect(data.customerId).toBeUndefined();
    expect(data.preferredEmployeeId).toBeUndefined();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('hides an unassigned customer from an employee the same way as a missing row', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 7, isActive: true, userId: 10 });
    prisma.customer.findUnique.mockResolvedValueOnce({
      id: 55,
      userId: 20,
      preferredEmployeeId: 99,
      user: { phone: '09120000000' },
    });

    const foreign = await service
      .update(55, { notes: 'x' } as never, { id: 10, role: 'EMPLOYEE' })
      .catch((error: unknown) => error);

    prisma.customer.findUnique.mockResolvedValueOnce(null);
    const missing = await service
      .update(404, { notes: 'x' } as never, { id: 10, role: 'EMPLOYEE' })
      .catch((error: unknown) => error);

    expect(foreign).toBeInstanceOf(NotFoundException);
    expect(missing).toBeInstanceOf(NotFoundException);
    expect((foreign as NotFoundException).getStatus()).toBe(404);
    expect((foreign as NotFoundException).getResponse()).toEqual(
      (missing as NotFoundException).getResponse(),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns 404 from the service when the customer row is missing', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(
      service.findOne(55, { id: 10, role: 'CUSTOMER' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
