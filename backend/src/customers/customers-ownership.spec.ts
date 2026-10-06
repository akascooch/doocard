import { ForbiddenException, NotFoundException } from '@nestjs/common';
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

    expect(service.findOne).toHaveBeenCalledWith(55);
  });

  it('rejects a customer whose user id equals another customer primary key', async () => {
    prisma.customer.findUnique.mockResolvedValue({ userId: 99 });

    await expect(
      controller.findOne(10, { user: { id: 10, role: 'CUSTOMER' } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it('rejects a customer update of another customer id', async () => {
    prisma.customer.findUnique.mockResolvedValue({ userId: 20 });

    await expect(
      controller.update(55, { notes: 'x' } as never, { user: { id: 10, role: 'CUSTOMER' } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
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
    expect(service.findOne).toHaveBeenCalledWith(55);
  });
});

describe('CustomersService customer update ownership', () => {
  const prisma = {
    customer: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn(), update: jest.fn() },
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
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
