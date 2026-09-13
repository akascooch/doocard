import {
  BACKUP_ALLOWED_DATA_KEYS,
  BACKUP_DEFERRED_MODEL_KEYS,
  BACKUP_DELETE_ORDER,
  BACKUP_FORBIDDEN_DATA_KEYS,
  BACKUP_INSERT_ORDER,
} from './backup.types';

/**
 * Prisma client delegate names for every model in schema.prisma.
 * Keep this list in lockstep with schema — the test fails when a new model
 * is added and neither covered nor explicitly deferred/forbidden.
 */
const SCHEMA_PRISMA_DELEGATES = [
  'user',
  'refreshToken',
  'otpChallenge',
  'pushSubscription',
  'employee',
  'customer',
  'service',
  'calendarDate',
  'appointment',
  'appointmentService',
  'employeeService',
  'transaction',
  'transactionCategory',
  'employeeCommissionSettlement',
  'employeeCommissionSettlementAppointment',
  'employeeCommissionSettlementTransaction',
  'bankAccount',
  'chequebook',
  'chequeLeaf',
  'category',
  'tip',
  'appointmentTipAllocation',
  'tipSource',
  'manualTipAllocation',
  'salary',
  'employeeSalaryRequest',
  'permission',
  'smsLog',
  'smsSettings',
  'smsTemplate',
  'smsEvent',
  'smsNotificationRule',
  'homepageDetails',
  'landingSlide',
  'dayClosing',
  'customerDebt',
  'workSchedule',
  'blockedTime',
  'notification',
  'importJob',
  'financialReportsAccess',
  'systemSettings',
  'productCategory',
  'product',
  'inventoryMovement',
  'appointmentProduct',
  'order',
  'orderItem',
  'productStockSubscription',
  'adminDailyFrog',
  'adminPersonalExpense',
] as const;

describe('backup coverage vs Prisma schema', () => {
  const insert = new Set<string>(BACKUP_INSERT_ORDER);
  const del = new Set<string>(BACKUP_DELETE_ORDER);
  const deferred = new Set<string>(BACKUP_DEFERRED_MODEL_KEYS);
  const forbidden = new Set(
    BACKUP_FORBIDDEN_DATA_KEYS.map((k) => k.charAt(0).toLowerCase() + k.slice(1)),
  );

  it('insert and delete orders contain the same keys', () => {
    expect([...insert].sort()).toEqual([...del].sort());
  });

  it('every schema model is covered, deferred, or forbidden', () => {
    const unexplained: string[] = [];
    for (const key of SCHEMA_PRISMA_DELEGATES) {
      if (insert.has(key) || deferred.has(key) || forbidden.has(key)) {
        continue;
      }
      unexplained.push(key);
    }
    expect(unexplained).toEqual([]);
  });

  it('does not export deferred or forbidden models', () => {
    expect(BACKUP_ALLOWED_DATA_KEYS.has('otpChallenge')).toBe(false);
    expect(BACKUP_ALLOWED_DATA_KEYS.has('systemSettings')).toBe(false);
  });

  it('includes previously missing live shop/tip/salary models', () => {
    const required = [
      'smsNotificationRule',
      'productCategory',
      'product',
      'appointmentProduct',
      'inventoryMovement',
      'order',
      'orderItem',
      'productStockSubscription',
      'tipSource',
      'manualTipAllocation',
      'appointmentTipAllocation',
      'employeeSalaryRequest',
    ];
    for (const key of required) {
      expect(insert.has(key)).toBe(true);
      expect(del.has(key)).toBe(true);
    }
  });

  it('inserts settlement-linked tip allocations after settlements', () => {
    const insertList = BACKUP_INSERT_ORDER as readonly string[];
    const settlementIdx = insertList.indexOf('employeeCommissionSettlement');
    expect(insertList.indexOf('appointmentTipAllocation')).toBeGreaterThan(settlementIdx);
    expect(insertList.indexOf('manualTipAllocation')).toBeGreaterThan(settlementIdx);
    expect(insertList.indexOf('employeeSalaryRequest')).toBeGreaterThan(
      insertList.indexOf('transaction'),
    );
  });
});
