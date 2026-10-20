import { CustomersController } from './customers.controller';

describe('GET /customers mine scope [R6]', () => {
  const service = {
    findAll: jest.fn(),
    searchCustomers: jest.fn(),
    findVisibleToStaff: jest.fn(),
    findOwnedByEmployee: jest.fn(),
  };
  const prisma = {
    employee: { findUnique: jest.fn() },
  };

  let controller: CustomersController;

  const ownedCustomer = { id: 1, preferredEmployeeId: 7 };
  const otherCustomer = { id: 2, preferredEmployeeId: 99 };

  beforeEach(() => {
    jest.clearAllMocks();
    service.findAll.mockResolvedValue([ownedCustomer, otherCustomer]);
    service.searchCustomers.mockResolvedValue([ownedCustomer, otherCustomer]);
    service.findVisibleToStaff.mockResolvedValue([ownedCustomer, otherCustomer]);
    service.findOwnedByEmployee.mockResolvedValue([ownedCustomer]);
    prisma.employee.findUnique.mockResolvedValue({ id: 7, isActive: true, userId: 50 });
    controller = new CustomersController(service as never, prisma as never);
  });

  it('EMPLOYEE lists only customers owned by that employee', async () => {
    const result = await controller.findAll(undefined, undefined, '1', {
      user: { id: 50, role: 'EMPLOYEE' },
    });

    expect(prisma.employee.findUnique).toHaveBeenCalledWith({
      where: { userId: 50 },
    });
    expect(service.findOwnedByEmployee).toHaveBeenCalledWith(7, undefined);
    expect(service.findVisibleToStaff).not.toHaveBeenCalled();
    expect(service.findAll).not.toHaveBeenCalled();
    expect(result).toEqual([ownedCustomer]);
  });

  it('includes an owned customer with zero visits and excludes a non-owned appointment customer', async () => {
    service.findOwnedByEmployee.mockImplementation(async (employeeId: number) => {
      const rows = [
        { id: 1, preferredEmployeeId: employeeId, appointments: [] },
        { id: 2, preferredEmployeeId: 99, appointments: [{ employeeId }] },
      ];
      return rows.filter((row) => row.preferredEmployeeId === employeeId);
    });

    const result = await controller.findAll(undefined, undefined, undefined, {
      user: { id: 50, role: 'EMPLOYEE' },
    });

    expect(result).toEqual([
      expect.objectContaining({ id: 1, preferredEmployeeId: 7 }),
    ]);
    expect(result).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 2 })]),
    );
  });

  it('EMPLOYEE search stays inside the owned-customer scope', async () => {
    const result = await controller.findAll('علی', undefined, '1', {
      user: { id: 50, role: 'EMPLOYEE' },
    });
    expect(service.findOwnedByEmployee).toHaveBeenCalledWith(7, 'علی');
    expect(result).toEqual([ownedCustomer]);
    expect(service.searchCustomers).not.toHaveBeenCalled();
  });

  it('SERVICE still lists owned or personally served customers', async () => {
    await controller.findAll(undefined, undefined, '1', {
      user: { id: 50, role: 'SERVICE' },
    });

    expect(service.findVisibleToStaff).toHaveBeenCalledWith(7, undefined);
    expect(service.findOwnedByEmployee).not.toHaveBeenCalled();
  });

  it('ADMIN without mine returns the unscoped catalog', async () => {
    const result = await controller.findAll(undefined, undefined, undefined, {
      user: { id: 1, role: 'ADMIN' },
    });

    expect(prisma.employee.findUnique).not.toHaveBeenCalled();
    expect(service.findAll).toHaveBeenCalledWith(undefined);
    expect(result).toEqual([ownedCustomer, otherCustomer]);
  });

  it('EMPLOYEE without mine=1 still cannot read the unscoped catalog', async () => {
    await controller.findAll(undefined, undefined, undefined, {
      user: { id: 50, role: 'EMPLOYEE' },
    });

    expect(service.findOwnedByEmployee).toHaveBeenCalledWith(7, undefined);
    expect(service.findAll).not.toHaveBeenCalled();
  });
});
