import * as bcrypt from 'bcrypt';
import { commitEligibleCustomerRows } from './customer-commit.lib';
import { ensureCustomer, ensureGenericImportCustomer } from './appointment-commit.lib';
import { hashUnreachableCustomerBootstrap } from './import-bootstrap-password';
import { GENERIC_IMPORT_CUSTOMER_PHONE } from './appointment-workbook.parser';

const RETIRED_IMPORT_PASSWORDS = ['excel-import-no-login', '123456'];

describe('import bootstrap passwords', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hashes a fresh random secret and does not return the plaintext', async () => {
    const hashA = await hashUnreachableCustomerBootstrap();
    const hashB = await hashUnreachableCustomerBootstrap();

    expect(hashA.startsWith('$2')).toBe(true);
    expect(hashB.startsWith('$2')).toBe(true);
    expect(hashA).not.toBe(hashB);
    expect(hashA).not.toMatch(/^[0-9a-f]{64}$/);
    expect(hashB).not.toMatch(/^[0-9a-f]{64}$/);
    for (const retired of RETIRED_IMPORT_PASSWORDS) {
      await expect(bcrypt.compare(retired, hashA)).resolves.toBe(false);
      await expect(bcrypt.compare(retired, hashB)).resolves.toBe(false);
    }
  });

  it('creates customer rows with distinct unreachable hashes and ignores spreadsheet role', async () => {
    const created: Array<Record<string, unknown>> = [];
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: created.length, ...data };
        }),
      },
      customer: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
    };

    const result = await commitEligibleCustomerRows(prisma as never, [
      {
        sourceFile: 'a.xlsx',
        rowNumber: 2,
        name: 'One',
        phone: '09120000001',
        email: null,
        birthdateRaw: null,
        notes: null,
        role: 'ADMIN',
      },
      {
        sourceFile: 'a.xlsx',
        rowNumber: 3,
        name: 'Two',
        phone: '09120000002',
        email: null,
        birthdateRaw: null,
        notes: null,
        role: 'EMPLOYEE',
      },
    ] as never);

    expect(result).toEqual({ created: 2, skippedExisting: 0, skippedDuplicate: 0, failed: 0 });
    expect(JSON.stringify(result)).not.toMatch(/\$2[aby]\$/);
    expect(created).toHaveLength(2);
    expect(created[0].role).toBe('CUSTOMER');
    expect(created[1].role).toBe('CUSTOMER');
    expect(created[0].password).not.toBe(created[1].password);
    expect(String(created[0].password).startsWith('$2')).toBe(true);
    for (const row of created) {
      for (const retired of RETIRED_IMPORT_PASSWORDS) {
        await expect(bcrypt.compare(retired, String(row.password))).resolves.toBe(false);
      }
      expect(JSON.stringify(result)).not.toContain(String(row.password));
    }
  });

  it('does not overwrite an existing customer password', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 9, customer: { id: 4 }, password: 'kept' }),
        create: jest.fn(),
        update: jest.fn(),
      },
      customer: { create: jest.fn() },
    };

    const result = await commitEligibleCustomerRows(prisma as never, [
      {
        sourceFile: 'a.xlsx',
        rowNumber: 2,
        name: 'Existing',
        phone: '09120000009',
        email: null,
        birthdateRaw: null,
        notes: null,
      },
    ]);

    expect(result.skippedExisting).toBe(1);
    expect(result.created).toBe(0);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });

  it('does not replace an existing appointment-import user password', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 4,
          password: 'kept',
          customer: { id: 8 },
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
      customer: { create: jest.fn() },
    };

    const found = await ensureCustomer(tx as never, '09120000004', 'Kept', new Map());

    expect(found).toEqual({ customerId: 8, userId: 4 });
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('creates a generic import customer with role CUSTOMER and an unreachable hash', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: { data: { password: string; role: string; phone: string } }) => ({
          id: 1,
          ...data,
          customer: null,
        })),
      },
      customer: { create: jest.fn().mockResolvedValue({ id: 2 }) },
    };

    await ensureGenericImportCustomer(prisma as never);

    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.role).toBe('CUSTOMER');
    expect(data.phone).toBe(GENERIC_IMPORT_CUSTOMER_PHONE);
    expect(String(data.password).startsWith('$2')).toBe(true);
    expect(data.password).not.toBe(data.phone);
    for (const retired of RETIRED_IMPORT_PASSWORDS) {
      await expect(bcrypt.compare(retired, data.password)).resolves.toBe(false);
    }
  });

  it('reuses a generic import customer without writing a password', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 3, customer: { id: 6 }, password: 'kept' }),
        create: jest.fn(),
        update: jest.fn(),
      },
      customer: { create: jest.fn() },
    };

    await ensureGenericImportCustomer(prisma as never);

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });
});
