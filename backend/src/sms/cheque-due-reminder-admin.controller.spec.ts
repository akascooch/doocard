import { BadRequestException, HttpException, HttpStatus, ValidationPipe } from '@nestjs/common';
import {
  ChequeDueReminderAdminController,
  ChequeReminderTestSendDto,
} from './cheque-due-reminder-admin.controller';
import { ChequeDueSmsReminderService } from './cheque-due-sms-reminder.service';

describe('ChequeReminderTestSendDto under the global ValidationPipe (main.ts options)', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const validate = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: ChequeReminderTestSendDto, data: '' });

  it('accepts a JSON boolean true', async () => {
    const dto = await validate({ confirm: true, leafId: 3 });
    expect(dto.confirm).toBe(true);
    expect(dto.leafId).toBe(3);
  });

  it.each([false, 'false', 'true', 1, '1', null])('never turns confirm=%p into true', async (confirm) => {
    const outcome = await validate({ confirm }).catch((e) => e);
    if (outcome instanceof BadRequestException) return;
    expect(outcome.confirm).not.toBe(true);
  });
});

describe('ChequeDueReminderAdminController', () => {
  const reminders = {
    previewPlan: jest.fn().mockResolvedValue({ count: 0, items: [] }),
    isTestMode: jest.fn(),
    sendTestReminder: jest.fn().mockResolvedValue({ leafId: 1, results: [] }),
  };
  let controller: ChequeDueReminderAdminController;
  const req = { user: { id: 1, role: 'ADMIN' } };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ChequeDueReminderAdminController(reminders as never);
  });

  it('is ADMIN-only', () => {
    expect(Reflect.getMetadata('roles', ChequeDueReminderAdminController)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata('path', ChequeDueReminderAdminController)).toBe(
      'admin/sms/cheques/due-reminder',
    );
  });

  it('preview only reads the plan', async () => {
    await controller.preview('2');
    expect(reminders.previewPlan).toHaveBeenCalledWith({ days: 2 });
    expect(reminders.sendTestReminder).not.toHaveBeenCalled();
  });

  it('test-send requires confirm=true', async () => {
    reminders.isTestMode.mockReturnValue(true);
    await expect(controller.testSend({ confirm: false }, req)).rejects.toBeInstanceOf(BadRequestException);
    expect(reminders.sendTestReminder).not.toHaveBeenCalled();
  });

  it('test-send refuses without an allowlist', async () => {
    reminders.isTestMode.mockReturnValue(false);
    await expect(controller.testSend({ confirm: true }, req)).rejects.toBeInstanceOf(BadRequestException);
    expect(reminders.sendTestReminder).not.toHaveBeenCalled();
  });

  it('test-send is rate limited: a second call within 5 minutes gets 429', async () => {
    reminders.isTestMode.mockReturnValue(true);
    await controller.testSend({ confirm: true, leafId: 5 }, req);
    expect(reminders.sendTestReminder).toHaveBeenCalledWith({ leafId: 5 });
    const second = controller.testSend({ confirm: true }, req);
    await expect(second).rejects.toBeInstanceOf(HttpException);
    await second.catch((err: HttpException) =>
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS),
    );
    expect(reminders.sendTestReminder).toHaveBeenCalledTimes(1);
  });

  it('preview through the real service with sending disabled makes zero send calls and masks phones', async () => {
    const env: Record<string, string> = { CHEQUE_DUE_SMS_ENABLED: 'false' };
    const smsOutbound = { sendIfAllowed: jest.fn() };
    const prisma = {
      chequeLeaf: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 9,
              leafNumber: 90,
              amount: 1_000n,
              payee: 'P',
              dueDate: new Date('2026-07-28T08:00:00Z'),
              category: 'NORMAL',
              chequebook: { serialNumber: 'S', bankAccount: { name: 'B', accountNo: '1234', cardNo: null, iban: null } },
            },
          ])
          .mockResolvedValue([]),
      },
      user: { findMany: jest.fn() },
      notification: { create: jest.fn() },
    };
    const realService = new ChequeDueSmsReminderService(
      { get: (key: string) => env[key] } as never,
      prisma as never,
      smsOutbound as never,
      { renderByKey: jest.fn().mockResolvedValue('body') } as never,
    );
    const realController = new ChequeDueReminderAdminController(realService);

    const preview = await realController.preview('3');

    expect(preview.enabled).toBe(false);
    expect(preview.count).toBeGreaterThan(0);
    expect(JSON.stringify(preview)).not.toMatch(/09\d{9}/);
    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
