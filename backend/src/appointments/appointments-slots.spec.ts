import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { CalendarService } from '../calendar/calendar.service';
import { FarazSmsSendService } from '../sms/faraz-sms-send.service';

describe('AppointmentsService slot generation', () => {
  let service: AppointmentsService;

  const mockPrisma = {
    employee: { findUnique: jest.fn() },
    workSchedule: { findMany: jest.fn() },
    appointment: { findMany: jest.fn() },
    blockedTime: { findMany: jest.fn() },
    smsNotificationRule: { findUnique: jest.fn().mockResolvedValue(null) },
  };

  const mockCalendarService = {
    getByGregorian: jest.fn().mockResolvedValue({ jalaliDayOfWeek: 1 }),
    toJalali: jest.fn(),
    toGregorian: jest.fn(),
    ensureExists: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AccountingService, useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: NotificationsGateway, useValue: {} },
        { provide: PushNotificationsService, useValue: {} },
        { provide: CalendarService, useValue: mockCalendarService },
        { provide: FarazSmsSendService, useValue: { sendSingle: jest.fn() } },
      ],
    }).compile();

    service = module.get(AppointmentsService);
    jest.clearAllMocks();

    mockPrisma.employee.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.workSchedule.findMany.mockResolvedValue([]);
    mockPrisma.blockedTime.findMany.mockResolvedValue([]);
  });

  const tehranDisplayTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Tehran',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

  const slotAtTehran = (slots: { time: string; available: boolean }[], hhmm: string) =>
    slots.find((s) => tehranDisplayTime(s.time) === hhmm);

  it('returns slots in 30-minute intervals within 10:00–22:00 Tehran', async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.getAvailableSlots({
      employeeId: 1,
      date: '2030-06-15',
    });

    const displayTimes = result.slots.map((s) => tehranDisplayTime(s.time));
    expect(displayTimes).toContain('10:00');
    expect(displayTimes).toContain('10:30');
    expect(displayTimes).toContain('21:30');
    expect(displayTimes).not.toContain('22:00');
    expect(displayTimes).not.toContain('09:30');

    const minutes = displayTimes.map((t) => Number(t.split(':')[1]));
    expect(minutes.every((m) => m === 0 || m === 30)).toBe(true);
  });

  it('treats a 60-minute booking at 14:00 as blocking 14:00 and 14:30 but not 15:00', async () => {
    // 14:00 Asia/Tehran on 2030-06-15 = 2030-06-15T10:30:00.000Z
    const aptStart = new Date('2030-06-15T10:30:00.000Z');
    mockPrisma.appointment.findMany.mockResolvedValue([
      { id: 1, scheduledAt: aptStart, durationMin: 60, status: 'CONFIRMED' },
    ]);

    const result = await service.getAvailableSlots({
      employeeId: 1,
      date: '2030-06-15',
      durationMin: 60,
      slotIntervalMin: 30,
    });

    expect(slotAtTehran(result.slots, '14:00')?.available).toBe(false);
    expect(slotAtTehran(result.slots, '14:30')?.available).toBe(false);
    expect(slotAtTehran(result.slots, '15:00')?.available).toBe(true);
  });

  it('rejects overlapping slot starts via half-open interval logic', async () => {
    const aptStart = new Date('2030-06-15T10:30:00.000Z'); // 14:00 Tehran
    mockPrisma.appointment.findMany.mockResolvedValue([
      { id: 1, scheduledAt: aptStart, durationMin: 60, status: 'CONFIRMED' },
    ]);

    const result = await service.getAvailableSlots({
      employeeId: 1,
      date: '2030-06-15',
      durationMin: 60,
      slotIntervalMin: 30,
    });

    expect(slotAtTehran(result.slots, '13:30')?.available).toBe(false);
    expect(slotAtTehran(result.slots, '14:00')?.available).toBe(false);
    expect(slotAtTehran(result.slots, '14:30')?.available).toBe(false);
    expect(slotAtTehran(result.slots, '15:00')?.available).toBe(true);
    expect(slotAtTehran(result.slots, '15:30')?.available).toBe(true);
  });

  it('allows a 60-minute appointment starting at 21:30 but not at 22:00', async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.getAvailableSlots({
      employeeId: 1,
      date: '2030-06-15',
      durationMin: 60,
      slotIntervalMin: 30,
    });

    expect(slotAtTehran(result.slots, '21:30')?.available).toBe(true);
    expect(slotAtTehran(result.slots, '22:00')).toBeUndefined();
  });

  it('does not apply min_2h slot masking for ADMIN staff', async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([]);

    const todayTehran = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
    const result = await service.getAvailableSlots(
      { employeeId: 1, date: todayTehran },
      { role: 'ADMIN' },
    );

    expect(result.slots.some((s) => s.reason === 'min_2h')).toBe(false);
  });

  it('applies min_2h slot masking for unauthenticated callers on today', async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([]);

    const todayTehran = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
    const nowUtc = new Date();
    const result = await service.getAvailableSlots({ employeeId: 1, date: todayTehran });

    const min2hSlots = result.slots.filter((s) => s.reason === 'min_2h');
    const next2hSlotExists = result.slots.some((s) => {
      const gapMinutes = (new Date(s.time).getTime() - nowUtc.getTime()) / 60000;
      return gapMinutes >= 0 && gapMinutes < 120;
    });

    if (next2hSlotExists) {
      expect(min2hSlots.length).toBeGreaterThan(0);
    }
  });
});

describe('AppointmentsService intervalsOverlap', () => {
  let service: AppointmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: {} },
        { provide: AccountingService, useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: NotificationsGateway, useValue: {} },
        { provide: PushNotificationsService, useValue: {} },
        { provide: CalendarService, useValue: {} },
        { provide: FarazSmsSendService, useValue: { sendSingle: jest.fn() } },
      ],
    }).compile();

    service = module.get(AppointmentsService);
  });

  it('detects true overlaps and allows back-to-back appointments', () => {
    const overlap = (service as any).intervalsOverlap.bind(service);
    const aStart = new Date('2030-06-15T10:30:00.000Z');
    const aEnd = new Date('2030-06-15T11:30:00.000Z');
    const bStart = new Date('2030-06-15T11:30:00.000Z');
    const bEnd = new Date('2030-06-15T12:30:00.000Z');

    expect(overlap(aStart, aEnd, aStart, aEnd)).toBe(true);
    expect(overlap(bStart, bEnd, aStart, aEnd)).toBe(false);
    expect(overlap(
      new Date('2030-06-15T11:00:00.000Z'),
      new Date('2030-06-15T12:00:00.000Z'),
      aStart,
      aEnd,
    )).toBe(true);
  });
});
