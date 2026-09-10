import { NotificationType } from '@prisma/client';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService.notifyAppointmentSettled [R1]', () => {
  const smsOutbound = { sendIfAllowed: jest.fn() };
  const notificationsService = { create: jest.fn() };
  const notificationsGateway = { sendToUser: jest.fn() };
  const pushNotificationsService = { sendToUser: jest.fn() };
  const prisma = {
    notification: { findFirst: jest.fn() },
  };

  let service: AppointmentsService;

  const appointment = {
    id: 42,
    employeeId: 7,
    amount: 5_000_000,
    barberPayoutGrossAmount: 5_000_000,
    barberPayoutNetAmount: 4_200_000,
    customer: {
      userId: 10,
      user: { name: 'مشتری تست' },
    },
    employee: { userId: 70 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.notification.findFirst.mockResolvedValue(null);
    notificationsService.create.mockImplementation(async (dto: { userIdTarget: number }) => ({
      id: dto.userIdTarget,
      ...dto,
    }));
    pushNotificationsService.sendToUser.mockResolvedValue({ sent: 1, failed: 0 });

    service = new AppointmentsService(
      prisma as never,
      {} as never,
      notificationsService as never,
      notificationsGateway as never,
      pushNotificationsService as never,
      {} as never,
      smsOutbound as never,
      {} as never,
      {} as never,
    );
  });

  it('sends in-app + Web Push and never calls sendIfAllowed', async () => {
    await (service as unknown as { notifyAppointmentSettled: Function }).notifyAppointmentSettled(
      appointment,
      5_000_000,
      0,
    );

    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();

    expect(notificationsService.create).toHaveBeenCalledTimes(2);
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.APPOINTMENT_SETTLED,
        userIdTarget: 10,
        relatedEntity: 'appointment:42',
      }),
    );
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.APPOINTMENT_SETTLED,
        userIdTarget: 70,
        relatedEntity: 'appointment.settled:42:emp:7',
        message: expect.stringMatching(/سهم خالص[\s\S]*۴۲۰/),
      }),
    );

    expect(notificationsGateway.sendToUser).toHaveBeenCalledWith(10, expect.any(Object));
    expect(notificationsGateway.sendToUser).toHaveBeenCalledWith(70, expect.any(Object));

    expect(pushNotificationsService.sendToUser).toHaveBeenCalledTimes(2);
    expect(pushNotificationsService.sendToUser).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        title: 'نوبت تسویه شد',
        data: expect.objectContaining({ appointmentId: 42 }),
      }),
    );
    expect(pushNotificationsService.sendToUser).toHaveBeenCalledWith(
      70,
      expect.objectContaining({
        title: 'تسویه نوبت انجام شد',
        data: expect.objectContaining({ relatedEntity: 'appointment.settled:42:emp:7' }),
      }),
    );
  });
});
