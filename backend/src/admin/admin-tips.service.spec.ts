import { BadRequestException } from '@nestjs/common';
import { AdminTipsService } from './admin-tips.service';

describe('AdminTipsService.create reserved keys', () => {
  it('rejects settle-manual-tip:{appointmentId} so checkout keys stay exclusive', async () => {
    const service = new AdminTipsService({ tipSource: { findUnique: jest.fn() } } as never, {
      notifyTipRecipients: jest.fn(),
    } as never);

    await expect(
      service.create(
        {
          amountToman: 5000,
          tipType: 'INDIVIDUAL',
          recipientEmployeeId: 8,
          effectiveJalali: '1405/07/30',
          idempotencyKey: 'settle-manual-tip:41',
        } as never,
        1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records an individual tip for an active barber and rejects kitchen and team barbers', async () => {
    const findUnique = jest.fn(async ({ where }: { where: { id: number } }) => {
      if (where.id === 4) {
        return { id: 4, isActive: true, user: { role: 'EMPLOYEE', name: 'آرایشگر' } };
      }
      if (where.id === 8) {
        return { id: 8, isActive: true, user: { role: 'KITCHEN', name: 'آشپز' } };
      }
      return { id: where.id, isActive: true, user: { role: 'EMPLOYEE', name: 'دیگر' } };
    });
    const service = new AdminTipsService(
      {
        employee: {
          findUnique,
          findMany: jest.fn().mockResolvedValue([
            { id: 4, user: { name: 'آرایشگر', role: 'EMPLOYEE' } },
          ]),
        },
      } as never,
      { notifyTipRecipients: jest.fn() } as never,
    );

    const preview = await service.preview({
      tipType: 'INDIVIDUAL',
      amountToman: 1000,
      effectiveJalali: '1403/03/15',
      recipientEmployeeId: 4,
    } as never);
    expect(preview.eligibleEmployeeIds).toEqual([4]);
    expect(preview.allocations[0].amountRial).toBe('10000');

    await expect(
      service.preview({
        tipType: 'INDIVIDUAL',
        amountToman: 1000,
        effectiveJalali: '1403/03/15',
        recipientEmployeeId: 8,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.preview({
        tipType: 'TEAM',
        amountToman: 1000,
        effectiveJalali: '1403/03/15',
        teamMemberIds: [4],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
