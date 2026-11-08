export const BACKUP_VERSION = '2.0.0';
export const MASK_PLACEHOLDER = '[REDACTED]';

export interface BackupMetadata {
  version: string;
  timestamp: string;
  database: string;
  modelCount: number;
  stats: Record<string, number>;
  maskedFields: string[];
}

export interface BackupPayload {
  metadata: BackupMetadata;
  data: Record<string, unknown[]>;
}

/**
 * Prisma client delegate keys.
 *
 * Coverage vs schema:
 * ADDED (shop/tips/salary/packages/lottery/loan):
 *   smsNotificationRule, productCategory, product, productPackaging,
 *   appointmentProduct, inventoryMovement, order, orderItem,
 *   productStockSubscription, tipSource, manualTipAllocation,
 *   appointmentTipAllocation, employeeSalaryRequest,
 *   servicePackageTemplateService,
 *   lotteryGroup, lotteryMember, lotteryCycle, lotterySlot,
 *   lotteryContributionEvent, lotteryPayoutEvent, lotteryArrear,
 *   lotteryLoanInstallmentEvent
 *
 * DEFERRED:
 *   otpChallenge — ephemeral hashed OTP rows.
 *   systemSettings — BACKUP_FORBIDDEN_DATA_KEYS (must not overwrite backup path/flags).
 *
 * FK notes:
 *   productPackaging before inventoryMovement / appointmentProduct / orderItem.
 *   servicePackageTemplateService after servicePackageTemplate + service.
 *   lotteryLoanInstallmentEvent after lotteryMember and transaction (transactionId).
 *   lotteryContributionEvent before lotteryArrear (optional contributionEventId).
 */

/** Prisma delegate keys — delete children first */
export const BACKUP_DELETE_ORDER = [
  'lotteryLoanInstallmentEvent',
  'lotteryArrear',
  'lotteryPayoutEvent',
  'lotteryContributionEvent',
  'lotterySlot',
  'lotteryCycle',
  'lotteryMember',
  'lotteryGroup',
  'customerPackageConsumption',
  'customerServicePackage',
  'servicePackageTemplateService',
  'servicePackageTemplate',
  'loyaltyPointTransaction',
  'customerWalletLedger',
  'adminPersonalExpense',
  'adminExpenseCategory',
  'adminDailyFrog',
  'adminFrogRecurrence',
  'productStockSubscription',
  'orderItem',
  'order',
  'inventoryMovement',
  'manualTipAllocation',
  'appointmentTipAllocation',
  'appointmentProduct',
  'employeeCommissionSettlementTransaction',
  'employeeCommissionSettlementAppointment',
  'employeeCommissionSettlement',
  'chequeLeaf',
  'chequebook',
  'appointmentService',
  'employeeService',
  'tip',
  'salary',
  'employeeSalaryRequest',
  'transaction',
  'customerDebt',
  'notification',
  'pushSubscription',
  'refreshToken',
  'blockedTime',
  'workSchedule',
  'appointment',
  'importJob',
  'smsLog',
  'smsEvent',
  'smsNotificationRule',
  'permission',
  'dayClosing',
  'customer',
  'tipSource',
  'employee',
  'calendarDate',
  'service',
  'productPackaging',
  'product',
  'productCategory',
  'transactionCategory',
  'bankAccount',
  'category',
  'smsTemplate',
  'smsSettings',
  'homepageDetails',
  'landingSlide',
  'financialReportsAccess',
  'user',
] as const;

/** Insert parents before children */
export const BACKUP_INSERT_ORDER = [
  'user',
  'transactionCategory',
  'category',
  'bankAccount',
  'service',
  'calendarDate',
  'smsSettings',
  'smsTemplate',
  'smsNotificationRule',
  'homepageDetails',
  'landingSlide',
  'financialReportsAccess',
  'productCategory',
  'product',
  'productPackaging',
  'employee',
  'customer',
  'servicePackageTemplate',
  'servicePackageTemplateService',
  'loyaltyPointTransaction',
  'customerWalletLedger',
  'permission',
  'refreshToken',
  'pushSubscription',
  'adminFrogRecurrence',
  'adminDailyFrog',
  'adminExpenseCategory',
  'adminPersonalExpense',
  'employeeService',
  'workSchedule',
  'blockedTime',
  'chequebook',
  'appointment',
  'appointmentService',
  'appointmentProduct',
  'customerServicePackage',
  'customerPackageConsumption',
  'tip',
  'customerDebt',
  'notification',
  'dayClosing',
  'importJob',
  'smsLog',
  'smsEvent',
  'tipSource',
  'transaction',
  'chequeLeaf',
  'salary',
  'employeeSalaryRequest',
  'employeeCommissionSettlement',
  'employeeCommissionSettlementAppointment',
  'employeeCommissionSettlementTransaction',
  'appointmentTipAllocation',
  'manualTipAllocation',
  'inventoryMovement',
  'order',
  'orderItem',
  'productStockSubscription',
  'lotteryGroup',
  'lotteryMember',
  'lotteryCycle',
  'lotterySlot',
  'lotteryContributionEvent',
  'lotteryPayoutEvent',
  'lotteryArrear',
  'lotteryLoanInstallmentEvent',
] as const;

export type BackupModelKey = (typeof BACKUP_INSERT_ORDER)[number];

/** Session/ephemeral data — wiped on restore but not re-inserted (tokens are masked). */
export const BACKUP_SKIP_RESTORE_INSERT: BackupModelKey[] = [
  'refreshToken',
  'pushSubscription',
];

/** Keep active login sessions stable during in-flight restore requests. */
export const BACKUP_SKIP_RESTORE_DELETE: BackupModelKey[] = [
  'refreshToken',
  'pushSubscription',
];

/** Models that must never be restored from backup JSON. */
export const BACKUP_FORBIDDEN_DATA_KEYS = [
  'systemSettings',
  'SystemSettings',
] as const;

/** Live Prisma models intentionally omitted from backup coverage (see file header). */
export const BACKUP_DEFERRED_MODEL_KEYS = ['otpChallenge'] as const;

export const BACKUP_ALLOWED_DATA_KEYS: ReadonlySet<string> = new Set(
  BACKUP_INSERT_ORDER as readonly string[],
);

export interface RestoreRowCount {
  expected: number;
  actual: number;
}

export interface RestoreResult {
  success: true;
  snapshotPath: string;
  restoredModels: BackupModelKey[];
  skippedModels: BackupModelKey[];
  rowCounts: Record<string, RestoreRowCount>;
  warnings: string[];
  stats: Record<string, number>;
}
