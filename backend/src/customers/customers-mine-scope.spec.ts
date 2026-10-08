import { CustomersController } from './customers.controller';

describe('GET /customers mine scope [R6]', () => {
  const service = {
    findAll: jest.fn(),
    searchCustomers: jest.fn(),
    findVisibleToStaff: jest.fn(),
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
    service.findVisibleToStaff.mockResolvedValue([mineCustomer]);
    prisma.employee.findUnique.mockResolvedValue({ id: 7, isActive: true, userId: 50 });
    controller = new CustomersController(service as never, prisma as never);
  });

  it('EMPLOYEE lists only customers owned by or served by that employee', async () => {
    await controller.findAll(undefined, undefined, '1', {
      user: { id: 50, role: 'EMPLOYEE' },
    });

    expect(prisma.employee.findUnique).toHaveBeenCalledWith({
      where: { userId: 50 },
    });
    expect(service.findVisibleToStaff).toHaveBeenCalledWith(7, undefined);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('EMPLOYEE search stays inside the same staff scope', async () => {
    const result = await controller.findAll('علی', undefined, '1', {
      user: { id: 50, role: 'EMPLOYEE' },
    });
    expect(service.findVisibleToStaff).toHaveBeenCalledWith(7, 'علی');
    expect(result).toEqual([mineCustomer]);
    expect(service.searchCustomers).not.toHaveBeenCalled();
  });

  it('ADMIN without mine returns the unscoped catalog', async () => {
    await controller.findAll(undefined, undefined, undefined, {
      user: { id: 1, role: 'ADMIN' },
    });

    expect(prisma.employee.findUnique).not.toHaveBeenCalled();
    expect(service.findAll).toHaveBeenCalledWith(undefined);
  });

  it('EMPLOYEE without mine=1 still cannot read the unscoped catalog', async () => {
    await controller.findAll(undefined, undefined, undefined, {
      user: { id: 50, role: 'EMPLOYEE' },
    });

    expect(service.findVisibleToStaff).toHaveBeenCalledWith(7, undefined);
    expect(service.findAll).not.toHaveBeenCalled();
  });
});
