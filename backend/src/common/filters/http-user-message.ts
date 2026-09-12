const TRANSLATIONS: Record<string, string> = {
  Unauthorized: 'دسترسی غیرمجاز. لطفاً وارد شوید.',
  Forbidden: 'شما مجاز به انجام این عملیات نیستید.',
  'Not Found': 'موردی یافت نشد.',
  'Bad Request': 'درخواست نامعتبر.',
  Conflict: 'تداخل در داده‌ها.',
  'Internal Server Error': 'خطای داخلی سرور.',
  'Service Unavailable': 'سرویس در دسترس نیست.',
  'Too Many Requests': 'تعداد درخواست‌ها بیش از حد مجاز است.',
  'Validation failed': 'اعتبارسنجی ناموفق بود.',
  'Customer not found': 'مشتری یافت نشد.',
  'Employee not found': 'آرایشگر یافت نشد.',
  'Appointment not found': 'نوبت یافت نشد.',
  'Session expired': 'نشست شما منقضی شده است.',
};

const PERSIAN_CHAR = /[\u0600-\u06FF]/;

export function toUserFacingFaMessage(message: string | string[], status: number): string {
  const msg = Array.isArray(message) ? message[0] : message;
  if (!msg) {
    return fallbackByStatus(status);
  }
  if (TRANSLATIONS[msg]) {
    return TRANSLATIONS[msg];
  }
  // Already a user-facing Persian string from the domain layer — keep it.
  if (PERSIAN_CHAR.test(msg)) {
    return msg;
  }
  for (const [key, value] of Object.entries(TRANSLATIONS)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  return fallbackByStatus(status, msg);
}

function fallbackByStatus(status: number, msg?: string): string {
  switch (status) {
    case 400:
      return 'درخواست نامعتبر. لطفاً ورودی‌ها را بررسی کنید.';
    case 401:
      return 'نشست شما منقضی شده. لطفاً دوباره وارد شوید.';
    case 403:
      return 'شما مجاز به انجام این عملیات نیستید.';
    case 404:
      return 'موردی یافت نشد.';
    case 409:
      return 'تداخل در داده‌ها. لطفاً دوباره تلاش کنید.';
    case 429:
      return 'تعداد درخواست‌ها بیش از حد مجاز است.';
    case 500:
      return 'خطای سرور. لطفاً چند لحظه دیگر تکرار کنید.';
    case 503:
      return 'سرویس موقتاً در دسترس نیست.';
    default:
      return msg || 'خطای ناشناخته';
  }
}
