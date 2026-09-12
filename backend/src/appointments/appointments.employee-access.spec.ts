import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { APPOINTMENT_NOT_FOUND_FA, EMPLOYEE_ACCESS_DENIED_FA } from './appointment-access.util';

describe('AppointmentsService employee authorization', () => {
  const prisma = {
    employee: { findUnique: jest.fn() },
    customer: { findUnique: jest.fn() },
    appointment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  function makeService() {
    return new AppointmentsService(
      prisma as unknown as PrismaService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('create: employee A cannot create for employee B', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 4, userId: 10 });
    const service = makeService();
    try {
      await service.create(
        { employeeId: 99, customerId: 1, services: [{ serviceId: 1 }] } as any,
        { id: 10, role: 'EMPLOYEE' },
      );
      fail('expected ForbiddenException');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).message).toBe(EMPLOYEE_ACCESS_DENIED_FA);
    }
  });

  it('create: employee without a profile is rejected', async () => {
    prisma.employee.findUnique.mockResolvedValue(null);
    const service = makeService();
    await expect(
      service.create(
        { customerId: 1, services: [{ serviceId: 1 }] } as any,
        { id: 10, role: 'EMPLOYEE' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('findAll: foreign employeeId query is rejected and does not return the other calendar', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 4, userId: 10 });
    const service = makeService();
    await expect(
      service.findAll({ employeeId: 99 } as any, { id: 10, role: 'EMPLOYEE' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });

  it('findAll: matching or omitted employeeId stays scoped to the actor', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 4, userId: 10 });
    prisma.appointment.findMany.mockResolvedValue([]);
    prisma.appointment.count.mockResolvedValue(0);
    const service = makeService();
    await service.findAll({ employeeId: 4 } as any, { id: 10, role: 'EMPLOYEE' });
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employeeId: 4, deletedAt: null }),
      }),
    );
  });

  it('findAll: admin may still select an arbitrary employee', async () => {
    prisma.appointment.findMany.mockResolvedValue([]);
    prisma.appointment.count.mockResolvedValue(0);
    const service = makeService();
    await service.findAll({ employeeId: 99 } as any, { id: 1, role: 'ADMIN' });
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employeeId: 99 }),
      }),
    );
    expect(prisma.employee.findUnique).not.toHaveBeenCalled();
  });

  it('findOne: another employee appointment is a generic 404', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 4, userId: 10 });
    prisma.appointment.findFirst.mockResolvedValue({
      id: 77,
      employeeId: 99,
      customerId: 2,
      services: [],
    });
    const service = makeService();
    try {
      await service.findOne(77, { id: 10, role: 'EMPLOYEE' });
      fail('expected NotFoundException');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).message).toBe(APPOINTMENT_NOT_FOUND_FA);
    }
  });

  it('findOne: admin can read any appointment', async () => {
    prisma.appointment.findFirst.mockResolvedValue({
      id: 77,
      employeeId: 99,
      customerId: 2,
      services: [],
      customer: null,
      employee: null,
    });
    const service = makeService();
    const result = await service.findOne(77, { id: 1, role: 'ADMIN' });
    expect(result.employeeId).toBe(99);
  });

  it('update: employee cannot reassign the appointment to another employee', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 4, userId: 10 });
    prisma.appointment.findFirst.mockResolvedValue({
      id: 77,
      employeeId: 4,
      customerId: 2,
      services: [],
      customer: null,
      employee: null,
    });
    const service = makeService();
    await expect(
      service.update(77, { employeeId: 99 } as any, { id: 10, role: 'EMPLOYEE' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cancel: another employee appointment is a generic 404', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 4, userId: 10 });
    prisma.appointment.findFirst.mockResolvedValue({
      id: 77,
      employeeId: 99,
      customerId: 2,
      services: [],
    });
    const service = makeService();
    try {
      await service.cancel(77, { id: 10, role: 'EMPLOYEE' });
      fail('expected NotFoundException');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).message).toBe(APPOINTMENT_NOT_FOUND_FA);
    }
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it('remove: another employee appointment is a generic 404', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 4, userId: 10 });
    prisma.appointment.findFirst.mockResolvedValue({
      id: 77,
      employeeId: 99,
      customerId: 2,
      services: [],
    });
    const service = makeService();
    await expect(service.remove(77, { id: 10, role: 'EMPLOYEE' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });
});
