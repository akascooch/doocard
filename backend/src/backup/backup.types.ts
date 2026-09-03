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

/** Prisma delegate keys — delete children first */
export const BACKUP_DELETE_ORDER = [
  'employeeCommissionSettlementTransaction',
  'employeeCommissionSettlementAppointment',
  'employeeCommissionSettlement',
  'chequeLeaf',
  'chequebook',
  'appointmentService',
  'employeeService',
  'tip',
  'salary',
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
  'permission',
  'dayClosing',
  'customer',
  'employee',
  'calendarDate',
  'service',
  'transactionCategory',
  'bankAccount',
  'category',
  'smsTemplate',
  'smsSettings',
  'homepageDetails',
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
  'homepageDetails',
  'financialReportsAccess',
  'employee',
  'customer',
  'permission',
  'refreshToken',
  'pushSubscription',
  'employeeService',
  'workSchedule',
  'blockedTime',
  'chequebook',
  'appointment',
  'appointmentService',
  'tip',
  'customerDebt',
  'notification',
  'dayClosing',
  'importJob',
  'smsLog',
  'smsEvent',
  'transaction',
  'chequeLeaf',
  'salary',
  'employeeCommissionSettlement',
  'employeeCommissionSettlementAppointment',
  'employeeCommissionSettlementTransaction',
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
