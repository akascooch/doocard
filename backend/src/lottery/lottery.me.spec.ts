import { UnprocessableEntityException } from '@nestjs/common';
import { LotteryService } from './lottery.service';

describe('LotteryService.me', () => {
  it('returns 422 MULTIPLE_GROUPS_UNSUPPORTED when two ACTIVE memberships exist', async () => {
    const prisma = {
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 8, userId: 4 }) },
      lotteryMember: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, groupId: 1, employeeId: 8, status: 'ACTIVE', group: {}, slots: [] },
          { id: 2, groupId: 2, employeeId: 8, status: 'ACTIVE', group: {}, slots: [] },
        ]),
      },
    };
    const service = new LotteryService(prisma as never);
    await expect(service.me(4)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MULTIPLE_GROUPS_UNSUPPORTED' }),
    });
    try {
      await service.me(4);
    } catch (err) {
      expect(err).toBeInstanceOf(UnprocessableEntityException);
    }
  });
});
