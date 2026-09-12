import { toUserFacingFaMessage } from './http-user-message';

describe('toUserFacingFaMessage', () => {
  it('keeps domain Persian 503 text instead of the generic fallback', () => {
    expect(
      toUserFacingFaMessage('سرویس ارسال کد تأیید پیکربندی نشده است', 503),
    ).toBe('سرویس ارسال کد تأیید پیکربندی نشده است');
  });

  it('keeps SMS-send failure Persian text', () => {
    expect(
      toUserFacingFaMessage('ارسال پیامک تأیید ناموفق بود. بعداً تلاش کنید.', 503),
    ).toBe('ارسال پیامک تأیید ناموفق بود. بعداً تلاش کنید.');
  });

  it('translates English Service Unavailable when no Persian body is present', () => {
    expect(toUserFacingFaMessage('Service Unavailable', 503)).toBe('سرویس در دسترس نیست.');
  });

  it('uses generic 503 fallback for empty messages', () => {
    expect(toUserFacingFaMessage('', 503)).toBe('سرویس موقتاً در دسترس نیست.');
  });
});
