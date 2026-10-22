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
});
