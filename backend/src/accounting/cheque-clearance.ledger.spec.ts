import { BadRequestException } from '@nestjs/common';
import { ChequeLeafCategory, ChequeLeafStatus } from '@prisma/client';
import { AccountingService } from './accounting.service';

describe('AccountingService cheque clearance ledger', () => {
  const prisma: any = {
    chequeLeaf: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
    },
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
  });
});
