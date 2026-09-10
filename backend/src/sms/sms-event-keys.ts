/**
 * Canonical SMS policy event keys (must match admin UI + defaults).
 */
export const SMS_EVENT_KEYS = {
  CUSTOMER_REGISTERED: 'customer.registered',
  CUSTOMER_CREATED_BY_ADMIN: 'customer.createdByAdmin',
  NOTIFICATION_CREATED: 'notification.created',
  APPOINTMENT_CREATED: 'appointment.created',
  APPOINTMENT_CONFIRMED: 'appointment.confirmed',
  APPOINTMENT_CANCELLED: 'appointment.cancelled',
  /** Barber settlement after checkout — in-app + Web Push only (SMS off by default + force-off on boot) */
  APPOINTMENT_SETTLED: 'appointment.settled',
  /** Cheque due-date reminders (T-3 / T-2 / T-1 / T-0) */
  CHEQUE_DUE_REMINDER: 'cheque.dueReminder',
  /** Tip received by SERVICE staff — SMS off by default (in-app + push only) */
  TIP_RECEIVED: 'tip.received',
  /** Daily staff account reconciliation reminder (13:00 and 20:00 Asia/Tehran) */
  ACCOUNT_RECONCILE_REMINDER: 'account.reconcile_reminder',
  /** Admin panel test send (policy-gated; default on) */
  ADMIN_TEST: 'admin.test',
  /** Admin panel custom free-text send (policy-gated; default on) */
  ADMIN_CUSTOM: 'admin.custom',
  /** New shop card-to-card order (admin alert) */
  SHOP_ORDER_CREATED: 'shop.orderCreated',
} as const;

export type SmsEventKey = (typeof SMS_EVENT_KEYS)[keyof typeof SMS_EVENT_KEYS];

export interface SmsPolicyDefault {
  eventKey: SmsEventKey;
  label: string;
  /** Default when no DB row exists */
  smsEnabled: boolean;
}

/** Allow-list defaults: only these events may get SMS; notification.created is off until enabled. */
export const DEFAULT_SMS_POLICY: SmsPolicyDefault[] = [
  {
    eventKey: SMS_EVENT_KEYS.CUSTOMER_REGISTERED,
    label: 'ثبت‌نام مشتری (خودکار)',
    smsEnabled: true,
  },
  {
    eventKey: SMS_EVENT_KEYS.CUSTOMER_CREATED_BY_ADMIN,
    label: 'ثبت مشتری توسط ادمین',
    smsEnabled: true,
  },
  {
    eventKey: SMS_EVENT_KEYS.NOTIFICATION_CREATED,
    label: 'اعلان دستی ادمین',
    smsEnabled: false,
  },
  {
    eventKey: SMS_EVENT_KEYS.APPOINTMENT_CREATED,
    label: 'ایجاد نوبت',
    smsEnabled: true,
  },
  {
    eventKey: SMS_EVENT_KEYS.APPOINTMENT_CONFIRMED,
    label: 'تأیید نوبت',
    smsEnabled: true,
  },
  {
    eventKey: SMS_EVENT_KEYS.APPOINTMENT_CANCELLED,
    label: 'لغو نوبت',
    smsEnabled: true,
  },
  {
    eventKey: SMS_EVENT_KEYS.APPOINTMENT_SETTLED,
    label: 'تسویه نوبت — آرایشگر',
    smsEnabled: false,
  },
  {
    eventKey: SMS_EVENT_KEYS.CHEQUE_DUE_REMINDER,
    label: 'یادآور سررسید چک',
    smsEnabled: true,
  },
  {
    eventKey: SMS_EVENT_KEYS.TIP_RECEIVED,
    label: 'دریافت انعام',
    smsEnabled: false,
  },
  {
    eventKey: SMS_EVENT_KEYS.ACCOUNT_RECONCILE_REMINDER,
    label: 'یادآور بررسی حساب روزانه',
    smsEnabled: true,
  },
  {
    eventKey: SMS_EVENT_KEYS.ADMIN_TEST,
    label: 'ارسال آزمایشی ادمین',
    smsEnabled: true,
  },
  {
    eventKey: SMS_EVENT_KEYS.ADMIN_CUSTOM,
    label: 'ارسال سفارشی ادمین',
    smsEnabled: true,
  },
  {
    eventKey: SMS_EVENT_KEYS.SHOP_ORDER_CREATED,
    label: 'سفارش جدید فروشگاه',
    smsEnabled: true,
  },
];
