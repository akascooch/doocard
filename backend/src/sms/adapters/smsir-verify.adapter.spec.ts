import { ConfigService } from '@nestjs/config';
import { SmsIrVerifyAdapter } from './smsir-verify.adapter';

describe('SmsIrVerifyAdapter', () => {
  function make(env: Record<string, string | undefined>) {
    const config = {
      get: jest.fn((key: string, fallback?: string) => env[key] ?? fallback ?? ''),
    };
    return new SmsIrVerifyAdapter(config as unknown as ConfigService);
  }

  it('isConfigured requires both API key and a positive template id', () => {
    expect(make({ SMS_API_KEY: 'k', SMS_IR_OTP_TEMPLATE_ID: '12' }).isConfigured()).toBe(true);
    expect(make({ SMS_API_KEY: 'k' }).isConfigured()).toBe(false);
    expect(make({ SMS_IR_OTP_TEMPLATE_ID: '12' }).isConfigured()).toBe(false);
    expect(make({ SMS_API_KEY: 'k', SMS_IR_OTP_TEMPLATE_ID: '0' }).isConfigured()).toBe(false);
    expect(make({ SMS_API_KEY: 'k', SMS_IR_OTP_TEMPLATE_ID: 'abc' }).isConfigured()).toBe(false);
  });

  it('sendVerifyCode fails closed without calling the network when unconfigured', async () => {
    const adapter = make({ SMS_API_KEY: 'k' });
    const result = await adapter.sendVerifyCode('09120000000', '12345');
    expect(result.success).toBe(false);
    expect(result.error).toBe('sms.ir verify is not configured');
  });
});
