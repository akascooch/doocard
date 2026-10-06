import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { APPOINTMENT_NOT_FOUND_FA } from './appointment-access.util';

describe('AppointmentsService cancel hardening', () => {
  const notifications = { create: jest.fn().mockResolvedValue({ id: 1 }) };
  const gateway = { sendToUser: jest.fn(), sendToRole: jest.fn() };
  const sms = { sendIfAllowed: jest.fn().mockResolvedValue({ success: true }) };
  const templates = { renderByKey: jest.fn().mockResolvedValue('sms') };
  const calendar = { toJalali: jest.fn().mockReturnValue('1405-07-14') };

  const prisma = {
    employee: { findUnique: jest.fn() },
    customer: { findUnique: jest.fn() },
    appointment: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  };

  function makeService() {
    return new AppointmentsService(
      prisma as unknown as PrismaService,
      {} as any,
      notifications as any,
      gateway as any,
      {} as any,
      calendar as any,
      sms as any,
      templates as any,
      {} as any,
    );
  }

  const owned = {
    id: 77,
    employeeId: 4,
    customerId: 8,
    status: 'CONFIRMED',
    services: [],
    scheduledAt: new Date('2026-10-06T07:30:00.000Z'),
    durationMin: 30,
    customer: {
      id: 8,
      userId: 3,
      user: { id: 3, name: 'مشتری', phone: '09120000000' },
    },
    employee: {
      id: 4,
      userId: 10,
      user: { id: 10, name: 'آرایشگر', phone: '09121111111' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an unauthenticated caller before reading the appointment', async () => {
    const service = makeService();
    await expect(service.cancel(77, null)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
    expect(sms.sendIfAllowed).not.toHaveBeenCalled();
  });

  it('lets the owning customer cancel and notifies once', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 8, userId: 3 });
    prisma.appointment.findFirst
      .mockResolvedValueOnce(owned)
      .mockResolvedValueOnce({
        ...owned,
        status: 'CANCELLED',
        calendarDate: { jalaliDate: '1405-07-14' },
      });
    prisma.appointment.updateMany.mockResolvedValue({ count: 1 });
    const service = makeService();

    const result = await service.cancel(77, { id: 3, role: 'CUSTOMER' });

    expect(result.status).toBe('CANCELLED');
    expect(prisma.appointment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { notIn: ['CANCELLED', 'SETTLED', 'PAID'] },
        }),
      }),
    );
    expect(notifications.create).toHaveBeenCalled();
    await Promise.resolve();
    await Promise.resolve();
    expect(sms.sendIfAllowed).toHaveBeenCalledTimes(1);
  });

  it('lets the owning employee cancel', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 4, userId: 10 });
    prisma.appointment.findFirst
      .mockResolvedValueOnce(owned)
      .mockResolvedValueOnce({
        ...owned,
        status: 'CANCELLED',
        calendarDate: { jalaliDate: '1405-07-14' },
      });
    prisma.appointment.updateMany.mockResolvedValue({ count: 1 });
    const service = makeService();

    const result = await service.cancel(77, { id: 10, role: 'EMPLOYEE' });
    expect(result.status).toBe('CANCELLED');
    await Promise.resolve();
    await Promise.resolve();
    expect(sms.sendIfAllowed).toHaveBeenCalledTimes(1);
  });

  it('hides another customer appointment with 404 and does not write', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 8, userId: 3 });
    prisma.appointment.findFirst.mockResolvedValue({
      ...owned,
      customerId: 99,
    });
    const service = makeService();

    await expect(
      service.cancel(77, { id: 3, role: 'CUSTOMER' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
    expect(sms.sendIfAllowed).not.toHaveBeenCalled();
  });

  it('hides another employee appointment with the generic 404', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 4, userId: 10 });
    prisma.appointment.findFirst.mockResolvedValue({
      ...owned,
      employeeId: 99,
    });
    const service = makeService();

    try {
      await service.cancel(77, { id: 10, role: 'EMPLOYEE' });
      fail('expected NotFoundException');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).message).toBe(APPOINTMENT_NOT_FOUND_FA);
    }
    expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
  });

  it.each(['SETTLED', 'PAID'])('rejects a %s appointment', async (status) => {
    prisma.appointment.findFirst.mockResolvedValue({ ...owned, status });
    const service = makeService();
    await expect(
      service.cancel(77, { id: 1, role: 'ADMIN' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('does not send a second notification when the appointment is already cancelled', async () => {
    prisma.appointment.findFirst.mockResolvedValue({
      ...owned,
      status: 'CANCELLED',
    });
    const service = makeService();
    const result = await service.cancel(77, { id: 1, role: 'ADMIN' });
    expect(result.status).toBe('CANCELLED');
    expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
    expect(sms.sendIfAllowed).not.toHaveBeenCalled();
  });

  it('does not overwrite a settle that won the race and does not notify', async () => {
    prisma.appointment.findFirst
      .mockResolvedValueOnce(owned)
      .mockResolvedValueOnce({ ...owned, status: 'SETTLED' });
    prisma.appointment.updateMany.mockResolvedValue({ count: 0 });
    const service = makeService();

    await expect(
      service.cancel(77, { id: 1, role: 'ADMIN' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.appointment.update).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
    expect(sms.sendIfAllowed).not.toHaveBeenCalled();
  });
});
