import { RequestMethod } from '@nestjs/common';
import { ChequeDueReminderAdminController } from './cheque-due-reminder-admin.controller';
import { ChequeDueSmsReminderService } from './cheque-due-sms-reminder.service';

describe('ChequeDueReminderAdminController', () => {
  it('is ADMIN-only on the due-reminder path', () => {
    expect(Reflect.getMetadata('roles', ChequeDueReminderAdminController)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata('path', ChequeDueReminderAdminController)).toBe(
      'admin/sms/cheques/due-reminder',
    );
  });

  it('exposes only GET preview (the allowlist test-send endpoint is removed)', () => {
    const proto = ChequeDueReminderAdminController.prototype as any;
    const routes = Object.getOwnPropertyNames(proto)
      .filter((name) => name !== 'constructor')
      .filter((name) => Reflect.getMetadata('path', proto[name]) !== undefined)
      .map((name) => [name, Reflect.getMetadata('method', proto[name]), Reflect.getMetadata('path', proto[name])]);
    expect(routes).toEqual([['preview', RequestMethod.GET, 'preview']]);
  });

  it('preview through the real service lists admins, masks phones, and makes zero send calls', async () => {
    const env: Record<string, string> = { CHEQUE_DUE_SMS_ENABLED: 'true' };
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
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, name: 'Owner', phone: '09370504588' },
          { id: 2, name: 'Manager', phone: '09121112233' },
        ]),
      },
      smsEvent: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { create: jest.fn(), findFirst: jest.fn() },
    };
    const realService = new ChequeDueSmsReminderService(
      { get: (key: string) => env[key] } as never,
      prisma as never,
      smsOutbound as never,
      { renderByKey: jest.fn().mockResolvedValue('body') } as never,
    );
    const controller = new ChequeDueReminderAdminController(realService);

    const preview = await controller.preview();

    expect(preview.enabled).toBe(true);
    expect(preview.recipients.map((r) => r.userId)).toEqual([1, 2]);
    expect(preview.count).toBe(2);
    expect(preview.items.every((i) => i.dispatch === 'pending')).toBe(true);
    expect(JSON.stringify(preview)).not.toMatch(/09\d{9}/);
    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
