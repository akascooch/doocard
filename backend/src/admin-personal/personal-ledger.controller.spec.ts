import { ForbiddenException } from '@nestjs/common';
import { AdminPersonalService } from './admin-personal.service';
import { PersonalLedgerController } from './personal-ledger.controller';

describe('PersonalLedgerController', () => {
  const service = {
    assertPersonalLedgerRole: jest.fn(),
    expenseSummary: jest.fn(),
    expenseBreakdown: jest.fn(),
    listExpenses: jest.fn(),
    createExpense: jest.fn(),
  };
  const controller = new PersonalLedgerController(service as unknown as AdminPersonalService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scopes summary to the authenticated user and never a client userId', async () => {
    service.expenseSummary.mockResolvedValue({ balance: '10' });
    await controller.expenseSummary({ user: { id: 8, role: 'EMPLOYEE' } });
    expect(service.assertPersonalLedgerRole).toHaveBeenCalledWith('EMPLOYEE');
    expect(service.expenseSummary).toHaveBeenCalledWith(8);
  });

  it('rejects SERVICE before reading the ledger', async () => {
    service.assertPersonalLedgerRole.mockImplementation(() => {
      throw new ForbiddenException('دسترسی به دفتر شخصی مجاز نیست');
    });
    expect(() =>
      controller.listExpenses({ user: { id: 9, role: 'SERVICE' } }, {}),
    ).toThrow(ForbiddenException);
    expect(service.listExpenses).not.toHaveBeenCalled();
  });
});
