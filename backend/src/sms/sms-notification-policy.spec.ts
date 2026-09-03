import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmsOutboundService } from './sms-outbound.service';
import { SmsNotificationPolicyService } from './sms-notification-policy.service';
import { FarazSmsSendService } from './faraz-sms-send.service';
import { PrismaService } from '../prisma/prisma.service';
import { SMS_EVENT_KEYS } from './sms-event-keys';
import { CustomerRegistrationSmsService } from './customer-registration-sms.service';
import { FarazEdgeAdapter } from './adapters/faraz-edge.adapter';
import { SmsTemplateService } from './sms-template.service';

describe('SmsNotificationPolicyService', () => {
  let policy: SmsNotificationPolicyService;
  const rules = new Map<string, { eventKey: string; smsEnabled: boolean; label: string }>();

  const prisma = {
    smsNotificationRule: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = rules.get(where.eventKey);
        const next = existing
          ? { ...existing, ...update, eventKey: where.eventKey }
          : { ...create };
        rules.set(where.eventKey, next);
        return { ...next, updatedAt: new Date(), createdAt: new Date(), id: 1 };
      }),
      findUnique: jest.fn(async ({ where }: any) => rules.get(where.eventKey) || null),
      findMany: jest.fn(async () => Array.from(rules.values())),
    },
  };

  beforeEach(async () => {
    rules.clear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsNotificationPolicyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    policy = module.get(SmsNotificationPolicyService);
  });

  it('allows default appointment.created', async () => {
    await expect(policy.isSmsAllowed(SMS_EVENT_KEYS.APPOINTMENT_CREATED)).resolves.toBe(true);
  });

  it('allows default appointment.settled for barber SMS', async () => {
    await expect(policy.isSmsAllowed(SMS_EVENT_KEYS.APPOINTMENT_SETTLED)).resolves.toBe(true);
  });

  it('denies notification.created by default', async () => {
    await expect(policy.isSmsAllowed(SMS_EVENT_KEYS.NOTIFICATION_CREATED)).resolves.toBe(false);
  });

  it('denies unknown keys', async () => {
    await expect(policy.isSmsAllowed('unknown.event')).resolves.toBe(false);
  });

  it('respects DB override', async () => {
    await policy.setSmsEnabled(SMS_EVENT_KEYS.NOTIFICATION_CREATED, true);
    await expect(policy.isSmsAllowed(SMS_EVENT_KEYS.NOTIFICATION_CREATED)).resolves.toBe(true);
  });
});

describe('SmsOutboundService', () => {
  let outbound: SmsOutboundService;
  const sendSingle = jest.fn();
  const policy = { isSmsAllowed: jest.fn() };
  const smsEvent = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    smsEvent.findUnique.mockResolvedValue(null);
    smsEvent.create.mockResolvedValue({});
    smsEvent.update.mockResolvedValue({});
    smsEvent.updateMany.mockResolvedValue({});
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsOutboundService,
        {
          provide: ConfigService,
          useValue: { get: (k: string, d?: string) => (k === 'SMS_ENABLED' ? 'true' : d) },
        },
        { provide: PrismaService, useValue: { smsEvent } },
        { provide: SmsNotificationPolicyService, useValue: policy },
        { provide: FarazSmsSendService, useValue: { sendSingle } },
      ],
    }).compile();
    outbound = module.get(SmsOutboundService);
  });

  it('skips when policy denies', async () => {
    policy.isSmsAllowed.mockResolvedValue(false);
    const r = await outbound.sendIfAllowed({
      eventKey: SMS_EVENT_KEYS.APPOINTMENT_CREATED,
      phone: '09123456789',
      message: 'hi',
      dedupeKey: 'k1',
    });
    expect(r.skipped).toBe(true);
    expect(sendSingle).not.toHaveBeenCalled();
    expect(smsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'BLOCKED' }),
      }),
    );
  });

  it('skips when already SENT (idempotent)', async () => {
    policy.isSmsAllowed.mockResolvedValue(true);
    smsEvent.findUnique.mockResolvedValue({ status: 'SENT' });
    const r = await outbound.sendIfAllowed({
      eventKey: SMS_EVENT_KEYS.APPOINTMENT_CREATED,
      phone: '09123456789',
      message: 'hi',
      dedupeKey: 'k1',
    });
    expect(r.success).toBe(true);
    expect(r.skipped).toBe(true);
    expect(sendSingle).not.toHaveBeenCalled();
  });

  it('soft-fails provider errors', async () => {
    policy.isSmsAllowed.mockResolvedValue(true);
    smsEvent.findUnique.mockResolvedValue(null);
    smsEvent.create.mockResolvedValue({});
    smsEvent.updateMany.mockResolvedValue({});
    sendSingle.mockResolvedValue({ success: false, error: 'provider down' });
    const r = await outbound.sendIfAllowed({
      eventKey: SMS_EVENT_KEYS.APPOINTMENT_CREATED,
      phone: '09123456789',
      message: 'hi',
      dedupeKey: 'k2',
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe('provider down');
    // primary + 2 always-CC admin phones
    expect(sendSingle).toHaveBeenCalledTimes(3);
  });

  it('fans out always-CC admin phones on successful send', async () => {
    policy.isSmsAllowed.mockResolvedValue(true);
    smsEvent.findUnique.mockResolvedValue(null);
    sendSingle.mockResolvedValue({ success: true });
    const r = await outbound.sendIfAllowed({
      eventKey: SMS_EVENT_KEYS.APPOINTMENT_CREATED,
      phone: '09121111111',
      message: 'test body',
      dedupeKey: 'k-cc',
    });
    expect(r.success).toBe(true);
    expect(sendSingle).toHaveBeenCalledTimes(3);
    expect(sendSingle).toHaveBeenCalledWith('09121013686', 'test body');
    expect(sendSingle).toHaveBeenCalledWith('09370504588', 'test body');
  });
});

describe('CustomerRegistrationSmsService.handleNewCustomer', () => {
  it('sends welcome + admin alerts via outbound', async () => {
    const sendIfAllowed = jest.fn().mockResolvedValue({ success: true });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerRegistrationSmsService,
        { provide: ConfigService, useValue: { get: () => 'true' } },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn().mockResolvedValue([
                { id: 9, phone: '09120000001' },
                { id: 10, phone: '09120000002' },
              ]),
            },
            employee: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
          },
        },
        { provide: FarazEdgeAdapter, useValue: {} },
        { provide: FarazSmsSendService, useValue: { sendSingle: jest.fn() } },
        { provide: SmsOutboundService, useValue: { sendIfAllowed } },
        {
          provide: SmsTemplateService,
          useValue: {
            renderByKey: jest.fn(async (_k: string, vars: any) =>
              `msg:${vars?.name || ''}`,
            ),
          },
        },
      ],
    }).compile();

    const svc = module.get(CustomerRegistrationSmsService);
    await svc.handleNewCustomer({
      name: 'علی',
      phone: '09121111111',
      userId: 42,
      source: 'self_register',
    });

    expect(sendIfAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: SMS_EVENT_KEYS.CUSTOMER_REGISTERED,
        dedupeKey: 'customer.welcome:42',
        phone: '09121111111',
      }),
    );
    expect(sendIfAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'customer.admin:42:9',
      }),
    );
    expect(sendIfAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'customer.admin:42:10',
      }),
    );
  });

  it('uses createdByAdmin event for admin create', async () => {
    const sendIfAllowed = jest.fn().mockResolvedValue({ success: true });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerRegistrationSmsService,
        { provide: ConfigService, useValue: { get: () => 'true' } },
        {
          provide: PrismaService,
          useValue: {
            user: { findMany: jest.fn().mockResolvedValue([]) },
            employee: { findUnique: jest.fn().mockResolvedValue(null) },
          },
        },
        { provide: FarazEdgeAdapter, useValue: {} },
        { provide: FarazSmsSendService, useValue: { sendSingle: jest.fn() } },
        { provide: SmsOutboundService, useValue: { sendIfAllowed } },
        {
          provide: SmsTemplateService,
          useValue: {
            renderByKey: jest.fn(async () => 'welcome'),
          },
        },
      ],
    }).compile();

    await module.get(CustomerRegistrationSmsService).handleNewCustomer({
      name: 'Sara',
      phone: '09123334444',
      userId: 7,
      source: 'admin_create',
    });

    expect(sendIfAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: SMS_EVENT_KEYS.CUSTOMER_CREATED_BY_ADMIN,
        dedupeKey: 'customer.welcome:7',
      }),
    );
  });
});
