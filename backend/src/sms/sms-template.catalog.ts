/**
 * Canonical in-app SMS template keys (NOT sms.ir provider template IDs).
 * Stored in sms_templates.name
 */
export const SMS_TEMPLATE_KEYS = {
  WELCOME_CUSTOMER: 'welcome_customer',
  ADMIN_NEW_CUSTOMER: 'admin_new_customer',
  /** Notify preferred barber when a new customer is assigned to them */
  NEW_CUSTOMER_BARBER: 'new_customer_barber',
  APPOINTMENT_CREATED_CUSTOMER: 'appointment_created_customer',
  APPOINTMENT_CREATED_BARBER: 'appointment_created_barber',
  APPOINTMENT_CONFIRMED_CUSTOMER: 'appointment_confirmed_customer',
  APPOINTMENT_CANCELLED_CUSTOMER: 'appointment_cancelled_customer',
  APPOINTMENT_SETTLED_BARBER: 'appointment_settled_barber',
  CHEQUE_DUE_REMINDER: 'cheque_due_reminder',
  TIP_RECEIVED: 'tip_received',
  SMS_TEST: 'sms_test',
  SMS_CUSTOM: 'sms_custom',
  /** Manual admin notification SMS (aligns with notifications.controller sendSms) */
  AD_HOC_NOTIFICATION: 'ad_hoc_notification',
} as const;

export type SmsTemplateKey =
  (typeof SMS_TEMPLATE_KEYS)[keyof typeof SMS_TEMPLATE_KEYS];

export interface SmsTemplateSeed {
  name: SmsTemplateKey;
  label: string;
  description: string;
  content: string;
  variables: string[];
}

/** Default free-text bodies used by the app (provider template IDs are not used). */
export const DEFAULT_SMS_TEMPLATES: SmsTemplateSeed[] = [
  {
    name: SMS_TEMPLATE_KEYS.WELCOME_CUSTOMER,
    label: 'خوش‌آمدگویی مشتری',
    description: 'پس از ثبت مشتری (خودکار یا ادمین) برای مشتری ارسال می‌شود.',
    content:
      'سلام {name} عزیز 🌿\nبه خانواده دوکارد خوش آمدید. از اینکه ما را انتخاب کردید خوشحالیم.\nبرای رزرو نوبت: doocardbarbershop.com\nمنتظرتان هستیم.',
    variables: ['name'],
  },
  {
    name: SMS_TEMPLATE_KEYS.ADMIN_NEW_CUSTOMER,
    label: 'اطلاع ادمین — مشتری جدید',
    description: 'هشدار به ادمین‌ها هنگام ثبت مشتری جدید.',
    content:
      'دوکارد: مشتری جدید ثبت شد.\nنام: {name}\nموبایل: {phone}\nمنبع: {source}',
    variables: ['name', 'phone', 'source'],
  },
  {
    name: SMS_TEMPLATE_KEYS.NEW_CUSTOMER_BARBER,
    label: 'اطلاع آرایشگر — مشتری جدید',
    description:
      'هنگام ثبت مشتری جدید، برای آرایشگر ترجیحی (preferredEmployee) ارسال می‌شود.',
    content:
      'دوکارد: مشتری جدید به شما اختصاص یافت.\nنام: {name}\nموبایل: {phone}',
    variables: ['name', 'phone'],
  },
  {
    name: SMS_TEMPLATE_KEYS.APPOINTMENT_CREATED_CUSTOMER,
    label: 'ایجاد نوبت — مشتری',
    description: 'پس از ثبت نوبت، برای مشتری (در انتظار تأیید).',
    content:
      'دوکاردی عزیز 💈\n\nنوبت شما با موفقیت ثبت شد و در انتظار تایید آرایشگر است.\n\n🧑‍🔧 آرایشگر: {employeeName}\n🗓 تاریخ: {jalaliDate}\n⏰ ساعت: {time}\n✂️ خدمات: {serviceNames}\n\nپس از تایید، پیامک نهایی برای شما ارسال خواهد شد.',
    variables: ['employeeName', 'jalaliDate', 'time', 'serviceNames'],
  },
  {
    name: SMS_TEMPLATE_KEYS.APPOINTMENT_CREATED_BARBER,
    label: 'ایجاد نوبت — آرایشگر',
    description: 'پس از ثبت نوبت، برای آرایشگر جهت تأیید/لغو.',
    content:
      'دوکاردی عزیز 💈\n\nیک نوبت جدید ثبت شده و نیاز به تایید شما دارد.\n\n👤 مشتری: {customerName}\n🗓 تاریخ: {jalaliDate}\n⏰ ساعت: {time}\n✂️ خدمات: {serviceNames}\n\nلطفاً در پنل مدیریت آن را تایید یا لغو کنید.',
    variables: ['customerName', 'jalaliDate', 'time', 'serviceNames'],
  },
  {
    name: SMS_TEMPLATE_KEYS.APPOINTMENT_CONFIRMED_CUSTOMER,
    label: 'تأیید نوبت — مشتری',
    description: 'پس از تأیید نوبت توسط آرایشگر، برای مشتری.',
    content:
      'دوکاردی عزیز 💈\n\nنوبت شما تایید شد ✅\n\n🧑‍🔧 آرایشگر: {employeeName}\n🗓 تاریخ: {jalaliDate}\n⏰ ساعت: {time}\n✂️ خدمات: {serviceNames}\n\nمنتظر دیدار شما هستیم 🌟',
    variables: ['employeeName', 'jalaliDate', 'time', 'serviceNames'],
  },
  {
    name: SMS_TEMPLATE_KEYS.APPOINTMENT_CANCELLED_CUSTOMER,
    label: 'لغو نوبت — مشتری',
    description: 'پس از لغو نوبت، برای مشتری.',
    content:
      'دوکاردی عزیز 💈\n\nمتأسفانه نوبت شما لغو شد ❌\n\n🧑‍🔧 آرایشگر: {employeeName}\n🗓 تاریخ: {jalaliDate}\n⏰ ساعت: {time}\n\nاز آرایشگاه با شما تماس گرفته می‌شود برای هماهنگی نوبت جدید.',
    variables: ['employeeName', 'jalaliDate', 'time'],
  },
  {
    name: SMS_TEMPLATE_KEYS.APPOINTMENT_SETTLED_BARBER,
    label: 'تسویه نوبت — آرایشگر',
    description:
      'پس از تسویه نوبت، برای آرایشگر نوبت ارسال می‌شود (مبلغ کل و سهم خالص snapshot تسویه).',
    content:
      'دوکارد — تسویه نوبت\nآرایشگر: {barberName}\nمشتری: {customerName}\nمبلغ کل: {grossAmount} تومان\nسهم تسویه: {netAmount} تومان\nکد نوبت: {appointmentId}',
    variables: [
      'barberName',
      'customerName',
      'grossAmount',
      'netAmount',
      'appointmentId',
      'date',
    ],
  },
  {
    name: SMS_TEMPLATE_KEYS.CHEQUE_DUE_REMINDER,
    label: 'یادآور سررسید چک',
    description: 'یادآور T-2 / T-1 / همان‌روز برای سررسید چک‌های صادرشده.',
    content:
      'دوکارد — یادآور چک ({offsetLabel})\nبرگه #{leafNumber}\nگیرنده: {payee}\nمبلغ: {amount}\nسررسید: {dueDate}',
    variables: ['offsetLabel', 'leafNumber', 'payee', 'amount', 'dueDate'],
  },
  {
    name: SMS_TEMPLATE_KEYS.TIP_RECEIVED,
    label: 'اطلاع انعام به پرسنل',
    description: 'پس از ثبت انعام (تسویه نوبت یا دستی) برای گیرنده SERVICE.',
    content:
      'دوکارد — انعام جدید\nمبلغ: {amount}\nمشتری: {customerName}\nآرایشگر: {barberName}\nمنبع: {source}',
    variables: ['amount', 'customerName', 'barberName', 'source'],
  },
  {
    name: SMS_TEMPLATE_KEYS.SMS_TEST,
    label: 'پیامک آزمایشی',
    description: 'متن پیش‌فرض ارسال آزمایشی از پنل ادمین (در صورت خالی بودن متن).',
    content:
      'دوکارد: پیامک آزمایشی سیستم اعلان‌ها. اگر این را دریافت کردید، تنظیمات SMS صحیح است.',
    variables: [],
  },
  {
    name: SMS_TEMPLATE_KEYS.SMS_CUSTOM,
    label: 'پیامک سفارشی (راهنما)',
    description:
      'دستهٔ گزارش برای ارسال سفارشی ادمین؛ متن واقعی از فرم ارسال گرفته می‌شود.',
    content: 'متن پیامک سفارشی را در فرم ارسال وارد کنید.',
    variables: [],
  },
  {
    name: SMS_TEMPLATE_KEYS.AD_HOC_NOTIFICATION,
    label: 'پیامک اعلان دستی ادمین',
    description:
      'هنگام ارسال نوتیفیکیشن دستی ادمین با sendSms؛ متن واقعی از عنوان+پیام ساخته می‌شود.',
    content: '{title}\n{message}',
    variables: ['title', 'message'],
  },
];
