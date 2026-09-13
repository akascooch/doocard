import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Logger } from '@nestjs/common';
import { SmsIrVerifyAdapter } from './smsir-verify.adapter';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SmsIrVerifyAdapter', () => {
  function make(env: Record<string, string | undefined>) {
    const config = {
      get: jest.fn((key: string, fallback?: string) => env[key] ?? fallback ?? ''),
    };
    return new SmsIrVerifyAdapter(config as unknown as ConfigService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('isConfigured requires both API key and a positive integer template id', () => {
    expect(make({ SMS_API_KEY: 'k', SMS_IR_OTP_TEMPLATE_ID: '12' }).isConfigured()).toBe(true);
    expect(make({ SMS_IR_API_KEY: 'alias', SMS_IR_OTP_TEMPLATE_ID: '12' }).isConfigured()).toBe(true);
    expect(make({ SMS_API_KEY: 'k' }).isConfigured()).toBe(false);
    expect(make({ SMS_IR_OTP_TEMPLATE_ID: '12' }).isConfigured()).toBe(false);
    expect(make({ SMS_API_KEY: 'k', SMS_IR_OTP_TEMPLATE_ID: '0' }).isConfigured()).toBe(false);
    expect(make({ SMS_API_KEY: 'k', SMS_IR_OTP_TEMPLATE_ID: '-3' }).isConfigured()).toBe(false);
    expect(make({ SMS_API_KEY: 'k', SMS_IR_OTP_TEMPLATE_ID: '12.5' }).isConfigured()).toBe(false);
    expect(make({ SMS_API_KEY: 'k', SMS_IR_OTP_TEMPLATE_ID: 'abc' }).isConfigured()).toBe(false);
  });

  it('sendVerifyCode fails closed without calling the network when unconfigured', async () => {
    const adapter = make({ SMS_API_KEY: 'k' });
    const result = await adapter.sendVerifyCode('09120000000', '12345');
    expect(result.success).toBe(false);
    expect(result.error).toBe('sms.ir verify is not configured');
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('POSTs sms.ir v1 verify payload and treats status 1 as success', async () => {
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: { status: 1, message: 'OK', data: { messageId: 99 } },
    });
    const adapter = make({
      SMS_API_KEY: 'k',
      SMS_IR_OTP_TEMPLATE_ID: '123456',
      SMS_IR_OTP_PARAM_NAME: 'CODE',
    });

    const result = await adapter.sendVerifyCode('+989120000000', '12345');

    expect(result).toEqual({ success: true, messageId: '99' });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.sms.ir/v1/send/verify',
      {
        mobile: '09120000000',
        templateId: 123456,
        parameters: [{ name: 'CODE', value: '12345' }],
      },
      expect.objectContaining({
        timeout: 15_000,
        headers: expect.objectContaining({
          'x-api-key': 'k',
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(mockedAxios.post.mock.calls[0][2]?.headers?.Authorization).toBeUndefined();
  });

  it('normalizes 0098 mobiles and uses SMS_IR_API_KEY when SMS_API_KEY is empty', async () => {
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: { status: 1, message: 'OK' },
    });
    const adapter = make({
      SMS_API_KEY: '',
      SMS_IR_API_KEY: 'alias-key',
      SMS_IR_OTP_TEMPLATE_ID: '12',
      SMS_IR_OTP_PARAM_NAME: 'OTPCODE',
    });

    const result = await adapter.sendVerifyCode('00989120000000', '00011');

    expect(result.success).toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.sms.ir/v1/send/verify',
      {
        mobile: '09120000000',
        templateId: 12,
        parameters: [{ name: 'OTPCODE', value: '00011' }],
      },
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-api-key': 'alias-key' }),
      }),
    );
  });

  it('prefers SMS_API_KEY over SMS_IR_API_KEY when both are set', async () => {
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: { status: 1, message: 'OK' },
    });
    const adapter = make({
      SMS_API_KEY: 'canonical-key',
      SMS_IR_API_KEY: 'legacy-key',
      SMS_IR_OTP_TEMPLATE_ID: '12',
    });

    await adapter.sendVerifyCode('09120000000', '12345');

    expect(mockedAxios.post.mock.calls[0][2]?.headers?.['x-api-key']).toBe('canonical-key');
  });

  it('treats SMS.ir status != 1 as failure', async () => {
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: { status: 0, message: 'template is invalid' },
    });
    const adapter = make({ SMS_API_KEY: 'k', SMS_IR_OTP_TEMPLATE_ID: '12' });

    const result = await adapter.sendVerifyCode('09120000000', '12345');

    expect(result.success).toBe(false);
    expect(result.error).toBe('template is invalid');
  });

  it('logs provider http/status/message when the request throws', async () => {
    mockedAxios.post.mockRejectedValue({
      message: 'Request failed with status code 401',
      response: { status: 401, data: { status: 401, message: 'api key is invalid' } },
    });
    const adapter = make({ SMS_API_KEY: 'k', SMS_IR_OTP_TEMPLATE_ID: '12' });

    const result = await adapter.sendVerifyCode('09120000000', '12345');

    expect(result.success).toBe(false);
    expect(result.error).toBe('api key is invalid');
  });

  it('treats a 2xx response with a malformed body as failure', async () => {
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: '<html>oops</html>',
    });
    const adapter = make({ SMS_API_KEY: 'k', SMS_IR_OTP_TEMPLATE_ID: '12' });

    const result = await adapter.sendVerifyCode('09120000000', '12345');

    expect(result.success).toBe(false);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('maps timeout/network errors without logging request headers', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    mockedAxios.post.mockRejectedValue({
      message: 'timeout of 15000ms exceeded',
      code: 'ECONNABORTED',
      config: { headers: { 'x-api-key': 'SUPERSECRET', Authorization: 'Bearer SUPERSECRET' } },
    });
    const adapter = make({ SMS_API_KEY: 'SUPERSECRET', SMS_IR_OTP_TEMPLATE_ID: '12' });

    const result = await adapter.sendVerifyCode('09120000000', '12345');

    expect(result.success).toBe(false);
    expect(result.error).toBe('timeout of 15000ms exceeded');
    const logged = errorSpy.mock.calls.map((call) => String(call[0])).join(' ');
    expect(logged).not.toContain('SUPERSECRET');
    expect(logged).not.toContain('Bearer');
    errorSpy.mockRestore();
  });
});
