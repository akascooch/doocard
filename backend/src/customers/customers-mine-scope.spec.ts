import { CustomersController } from './customers.controller';

describe('GET /customers mine scope [R6]', () => {
  const service = {
    findAll: jest.fn(),
    searchCustomers: jest.fn(),
  };
  const prisma = {
    employee: { findUnique: jest.fn() },
  };

  let controller: CustomersController;

  const mineCustomer = { id: 1, preferredEmployeeId: 7 };
  const otherCustomer = { id: 2, preferredEmployeeId: 99 };

  beforeEach(() => {
    jest.clearAllMocks();
    service.findAll.mockResolvedValue([mineCustomer, otherCustomer]);
    service.searchCustomers.mockResolvedValue([mineCustomer, otherCustomer]);
    prisma.employee.findUnique.mockResolvedValue({ id: 7, isActive: true, userId: 50 });
    controller = new CustomersController(service as never, prisma as never);
  });

  it('EMPLOYEE + mine=1 lists customers with preferredEmployeeId = that employee id', async () => {
    await controller.findAll(undefined, undefined, '1', {
      user: { id: 50, role: 'EMPLOYEE' },
    });

    expect(prisma.employee.findUnique).toHaveBeenCalledWith({
      where: { userId: 50 },
    });
    expect(service.findAll).toHaveBeenCalledWith(7);
    expect(service.searchCustomers).not.toHaveBeenCalled();
  });

  it('EMPLOYEE + mine=1 search filters by preferredEmployeeId = employee.id (JWT user.id lookup)', async () => {
    const result = await controller.findAll('علی', undefined, '1', {
      user: { id: 50, role: 'EMPLOYEE' },
    });

    expect(prisma.employee.findUnique).toHaveBeenCalledWith({
      where: { userId: 50 },
    });
    expect(service.searchCustomers).toHaveBeenCalledWith('علی');
    expect(result).toEqual([mineCustomer]);
  });

  it('ADMIN without mine returns the unscoped catalog', async () => {
    await controller.findAll(undefined, undefined, undefined, {
      user: { id: 1, role: 'ADMIN' },
    });

    expect(prisma.employee.findUnique).not.toHaveBeenCalled();
    expect(service.findAll).toHaveBeenCalledWith(undefined);
  });

  it('EMPLOYEE without mine=1 returns the unscoped catalog', async () => {
    await controller.findAll(undefined, undefined, undefined, {
      user: { id: 50, role: 'EMPLOYEE' },
    });

    expect(prisma.employee.findUnique).not.toHaveBeenCalled();
    expect(service.findAll).toHaveBeenCalledWith(undefined);
  });
});
