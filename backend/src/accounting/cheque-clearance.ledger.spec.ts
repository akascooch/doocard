import { BadRequestException } from '@nestjs/common';
import { ChequeLeafCategory, ChequeLeafStatus, ChequePayeeKind } from '@prisma/client';
import { AccountingService } from './accounting.service';

describe('AccountingService cheque clearance ledger', () => {
  const prisma: any = {
    chequeLeaf: {
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    transactionCategory: {
      findFirst: jest.fn(),
    },
    employee: {
      findUnique: jest.fn(),
    },
    bankAccount: {
      update: jest.fn(),
    },
    $transaction: jest.fn((callback: (client: any) => unknown) => callback(prisma)),
  };

  let service: AccountingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccountingService(
      prisma,
      { create: jest.fn() } as any,
      { sendToRole: jest.fn() } as any,
      { sendToRole: jest.fn() } as any,
    );
  });

  const leafBase = {
    id: 42,
    chequebookId: 3,
    leafNumber: 7,
    amount: 150000n,
    payee: 'فروشگاه X',
    category: ChequeLeafCategory.GUARANTEE,
    status: ChequeLeafStatus.ISSUED,
    transactionId: null as number | null,
    issuedAt: new Date(),
    clearedAt: null,
    chequebook: {
      id: 3,
      serialNumber: 'CB-1',
      bankAccountId: 9,
      bankAccount: { id: 9, name: 'بانک' },
    },
    transaction: null,
  };

  it('creates ledger txn when transitioning to CLEARED', async () => {
    prisma.chequeLeaf.findFirst.mockResolvedValue({ ...leafBase });
    const createSpy = jest
      .spyOn(service, 'createTransaction')
      .mockResolvedValue({ id: 500 } as any);
    prisma.chequeLeaf.update.mockResolvedValue({
      ...leafBase,
      status: ChequeLeafStatus.CLEARED,
      transactionId: 500,
      transaction: {
        id: 500,
        type: 'EXPENSE',
        amount: 150000n,
        occurredAt: new Date(),
        description: 'وصول چک | برگه #7',
      },
    });

    const result = await service.updateChequeLeaf(
      42,
      { status: ChequeLeafStatus.CLEARED } as any,
      1,
    );

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'EXPENSE',
        amount: 150000,
        accountId: 9,
        sourceType: 'CHEQUE_LEAF',
        sourceId: 42,
        paymentMethod: 'CHEQUE',
        description: expect.stringContaining('وصول چک'),
        meta: expect.objectContaining({
          externalRef: 'cheque-leaf-cleared:42',
          autoFromChequeClearance: true,
        }),
      }),
      1,
    );
    expect(result.transactionId).toBe(500);
    expect(createSpy.mock.calls[0][0].description).toContain('ضمانت');
  });

  it('does not create duplicate ledger when leaf already linked', async () => {
    prisma.chequeLeaf.findFirst.mockResolvedValue({
      ...leafBase,
      transactionId: 500,
    });
    const createSpy = jest.spyOn(service, 'createTransaction');
    prisma.chequeLeaf.update.mockResolvedValue({
      ...leafBase,
      status: ChequeLeafStatus.CLEARED,
      transactionId: 500,
      transaction: {
        id: 500,
        type: 'EXPENSE',
        amount: 150000n,
        occurredAt: new Date(),
        description: 'وصول چک',
      },
    });

    await service.updateChequeLeaf(42, { status: ChequeLeafStatus.CLEARED } as any, 1);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('reverseChequeClearedAccounting soft-deletes txn and reopens ISSUED', async () => {
    prisma.chequeLeaf.findFirst.mockResolvedValue({
      ...leafBase,
      status: ChequeLeafStatus.CLEARED,
      transactionId: 500,
    });
    const removeSpy = jest
      .spyOn(service, 'remove')
      .mockResolvedValue({ id: 500 } as any);
    prisma.chequeLeaf.update.mockResolvedValue({
      ...leafBase,
      status: ChequeLeafStatus.ISSUED,
      transactionId: null,
      clearedAt: null,
      transaction: null,
    });

    const out = await service.reverseChequeClearedAccounting(42);
    expect(removeSpy).toHaveBeenCalledWith(500);
    expect(out.status).toBe(ChequeLeafStatus.ISSUED);
    expect(out.transactionId).toBeNull();
  });

  it('rejects CLEARED without amount', async () => {
    prisma.chequeLeaf.findFirst.mockResolvedValue({
      ...leafBase,
      amount: null,
    });
    await expect(
      service.updateChequeLeaf(42, { status: ChequeLeafStatus.CLEARED } as any, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exposes stable externalRef helper', () => {
    expect(AccountingService.chequeClearedExternalRef(42)).toBe(
      'cheque-leaf-cleared:42',
    );
    expect(AccountingService.chequePayrollExternalRef(42)).toBe(
      'cheque-leaf-payroll:42',
    );
  });

  it('creates staff payroll expense without bank debit on ISSUED', async () => {
    prisma.chequeLeaf.findFirst.mockResolvedValue({
      ...leafBase,
      category: ChequeLeafCategory.NORMAL,
      payeeKind: null,
      employeeId: null,
      status: ChequeLeafStatus.BLANK,
      issuedAt: null,
      payee: null,
    });
    prisma.transaction.findFirst.mockResolvedValue(null);
    prisma.transactionCategory.findFirst.mockResolvedValue({
      id: 22,
      code: 'EMPLOYEE_WITHDRAWAL',
    });
    prisma.employee.findUnique.mockResolvedValue({
      id: 7,
      user: { name: 'علی رضایی' },
    });
    prisma.transaction.create.mockResolvedValue({
      id: 601,
      amount: 150000n,
      accountId: null,
      sourceType: 'CHEQUE_LEAF_PAYROLL',
    });
    prisma.chequeLeaf.update.mockResolvedValue({
      ...leafBase,
      category: ChequeLeafCategory.NORMAL,
      payeeKind: ChequePayeeKind.STAFF_SALARY,
      employeeId: 7,
      payee: 'علی رضایی',
      status: ChequeLeafStatus.ISSUED,
      transactionId: 601,
      transaction: {
        id: 601,
        type: 'EXPENSE',
        amount: 150000n,
        sourceType: 'CHEQUE_LEAF_PAYROLL',
        accountId: null,
      },
    });
    const createSpy = jest.spyOn(service, 'createTransaction');

    const result = await service.updateChequeLeaf(
      42,
      {
        status: ChequeLeafStatus.ISSUED,
        payeeKind: ChequePayeeKind.STAFF_SALARY,
        employeeId: 7,
        amount: 150000,
      } as any,
      1,
    );

    expect(createSpy).not.toHaveBeenCalled();
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'EXPENSE',
          amount: 150000n,
          employeeId: 7,
          categoryId: 22,
          accountId: null,
          sourceType: 'CHEQUE_LEAF_PAYROLL',
          sourceId: 42,
          paymentMethod: 'CHEQUE',
          meta: expect.objectContaining({
            externalRef: 'cheque-leaf-payroll:42',
          }),
        }),
      }),
    );
    expect(prisma.bankAccount.update).not.toHaveBeenCalled();
    expect(result.transactionId).toBe(601);
  });

  it('attaches bank to existing payroll on CLEARED and does not create a second expense', async () => {
    const payroll = {
      id: 601,
      amount: 150000n,
      accountId: null,
      sourceType: 'CHEQUE_LEAF_PAYROLL',
      employeeId: 7,
      deletedAt: null,
    };
    prisma.chequeLeaf.findFirst.mockResolvedValue({
      ...leafBase,
      category: ChequeLeafCategory.NORMAL,
      payeeKind: ChequePayeeKind.STAFF_SALARY,
      employeeId: 7,
      status: ChequeLeafStatus.ISSUED,
      transactionId: 601,
      transaction: payroll,
    });
    prisma.transaction.findFirst.mockResolvedValue(payroll);
    prisma.transactionCategory.findFirst.mockResolvedValue({
      id: 22,
      code: 'EMPLOYEE_WITHDRAWAL',
    });
    prisma.employee.findUnique.mockResolvedValue({
      id: 7,
      user: { name: 'علی رضایی' },
    });
    prisma.transaction.update.mockResolvedValue({
      ...payroll,
      accountId: 9,
    });
    prisma.chequeLeaf.update.mockResolvedValue({
      ...leafBase,
      category: ChequeLeafCategory.NORMAL,
      payeeKind: ChequePayeeKind.STAFF_SALARY,
      employeeId: 7,
      status: ChequeLeafStatus.CLEARED,
      transactionId: 601,
      transaction: { ...payroll, accountId: 9, type: 'EXPENSE' },
    });
    const createSpy = jest.spyOn(service, 'createTransaction');

    await service.updateChequeLeaf(
      42,
      { status: ChequeLeafStatus.CLEARED } as any,
      1,
    );

    expect(createSpy).not.toHaveBeenCalled();
    expect(prisma.bankAccount.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { balance: { decrement: 150000n } },
    });
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('rejects STAFF_SALARY on GUARANTEE cheques', async () => {
    prisma.chequeLeaf.findFirst.mockResolvedValue({
      ...leafBase,
      category: ChequeLeafCategory.GUARANTEE,
      status: ChequeLeafStatus.BLANK,
    });

    await expect(
      service.updateChequeLeaf(42, {
        status: ChequeLeafStatus.ISSUED,
        payeeKind: ChequePayeeKind.STAFF_SALARY,
        employeeId: 7,
        amount: 150000,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('soft-deletes payroll on BOUNCED without creating clearance expense', async () => {
    const payroll = {
      id: 601,
      amount: 150000n,
      accountId: null,
      sourceType: 'CHEQUE_LEAF_PAYROLL',
      deletedAt: null,
    };
    prisma.chequeLeaf.findFirst.mockResolvedValue({
      ...leafBase,
      category: ChequeLeafCategory.NORMAL,
      payeeKind: ChequePayeeKind.STAFF_SALARY,
      employeeId: 7,
      status: ChequeLeafStatus.ISSUED,
      transactionId: 601,
      transaction: payroll,
    });
    prisma.transaction.findFirst.mockResolvedValue(payroll);
    prisma.chequeLeaf.update.mockResolvedValue({
      ...leafBase,
      status: ChequeLeafStatus.BOUNCED,
      transactionId: null,
      transaction: null,
    });
    const createSpy = jest.spyOn(service, 'createTransaction');

    await service.updateChequeLeaf(42, { status: ChequeLeafStatus.BOUNCED } as any);

    expect(createSpy).not.toHaveBeenCalled();
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 601 },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prisma.bankAccount.update).not.toHaveBeenCalled();
  });

  it('reverse-clearance of staff payroll refunds bank and keeps payroll link', async () => {
    const payroll = {
      id: 601,
      amount: 150000n,
      accountId: 9,
      sourceType: 'CHEQUE_LEAF_PAYROLL',
      deletedAt: null,
    };
    prisma.chequeLeaf.findFirst.mockResolvedValue({
      ...leafBase,
      category: ChequeLeafCategory.NORMAL,
      payeeKind: ChequePayeeKind.STAFF_SALARY,
      employeeId: 7,
      status: ChequeLeafStatus.CLEARED,
      transactionId: 601,
      transaction: payroll,
    });
    prisma.transaction.findFirst.mockResolvedValue(payroll);
    prisma.chequeLeaf.update.mockResolvedValue({
      ...leafBase,
      category: ChequeLeafCategory.NORMAL,
      status: ChequeLeafStatus.ISSUED,
      transactionId: 601,
      clearedAt: null,
      transaction: { ...payroll, accountId: null },
    });
    const removeSpy = jest.spyOn(service, 'remove');

    const out = await service.reverseChequeClearedAccounting(42);

    expect(removeSpy).not.toHaveBeenCalled();
    expect(prisma.bankAccount.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { balance: { increment: 150000n } },
    });
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 601 },
      data: { accountId: null },
    });
    expect(out.status).toBe(ChequeLeafStatus.ISSUED);
    expect(out.transactionId).toBe(601);
  });

  it('dry-run backfill skips STAFF_SALARY query and does not duplicate existing ledger refs', async () => {
    prisma.chequeLeaf.findMany.mockResolvedValue([
      {
        id: 10,
        leafNumber: '10',
        amount: 100000n,
        payee: 'حقوق',
        category: ChequeLeafCategory.NORMAL,
        payeeKind: ChequePayeeKind.STAFF_SALARY,
        transactionId: null,
        chequebook: { id: 1, serialNumber: 'A', bankAccountId: 9 },
      },
      {
        id: 11,
        leafNumber: '11',
        amount: 200000n,
        payee: 'اجاره',
        category: ChequeLeafCategory.NORMAL,
        payeeKind: ChequePayeeKind.SUPPLIER,
        transactionId: null,
        chequebook: { id: 1, serialNumber: 'A', bankAccountId: 9 },
      },
      {
        id: 12,
        leafNumber: '12',
        amount: 300000n,
        payee: 'قبوض',
        category: ChequeLeafCategory.NORMAL,
        payeeKind: ChequePayeeKind.SUPPLIER,
        transactionId: null,
        chequebook: { id: 1, serialNumber: 'A', bankAccountId: 9 },
      },
    ]);
    prisma.transaction.findFirst.mockImplementation(async (args: { where?: any }) => {
      const sourceId = args?.where?.sourceId;
      const externalRef = args?.where?.meta?.path?.[0] === 'externalRef' ? args.where.meta.equals : null;
      if (sourceId === 10) return { id: 501 };
      if (externalRef === AccountingService.chequeClearedExternalRef(11)) return { id: 502 };
      return null;
    });

    const out = await service.backfillClearedChequeExpenses({ dryRun: true });

    expect(prisma.chequeLeaf.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ChequeLeafStatus.CLEARED,
          transactionId: null,
          NOT: { payeeKind: ChequePayeeKind.STAFF_SALARY },
        }),
      }),
    );
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(prisma.chequeLeaf.update).not.toHaveBeenCalled();
    expect(out).toMatchObject({
      dryRun: true,
      considered: 3,
      createdCount: 1,
      createdIds: [12],
    });
    expect(out.skipped).toEqual(
      expect.arrayContaining([
        { id: 10, reason: 'staff-payroll-exists' },
        { id: 11, reason: 'clearance-ref-exists' },
      ]),
    );
  });
});
