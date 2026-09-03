import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { SmsIrHttpAdapter } from './smsir-http.adapter';

describe('SmsIrHttpAdapter', () => {
  let adapter: SmsIrHttpAdapter;

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, string> = {
        SMS_API_KEY: 'test-smsir-key',
        SMS_LINE_NUMBER: '50003181890144',
        SMS_SENDER_NUMBER: '',
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config: Record<string, string> = {
        SMS_API_KEY: 'test-smsir-key',
        SMS_LINE_NUMBER: '50003181890144',
        SMS_SENDER_NUMBER: '',
      };
      return config[key] ?? defaultValue;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsIrHttpAdapter,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    adapter = module.get(SmsIrHttpAdapter);
  });

  it('is configured when api key and line number exist', () => {
    expect(adapter.isConfigured()).toBe(true);
  });

  it('is not configured when api key missing', () => {
    mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'SMS_API_KEY') return '';
      if (key === 'SMS_LINE_NUMBER') return '50003181890144';
      return defaultValue;
    });
    const unconfigured = new SmsIrHttpAdapter(
      mockConfigService as any,
      mockHttpService as any,
    );
    expect(unconfigured.isConfigured()).toBe(false);
  });

  it('sends with X-API-KEY and bulk payload shape', async () => {
    mockHttpService.post.mockReturnValue(
      of({
        status: 200,
        data: {
          status: 1,
          message: 'موفق',
          data: {
            packId: 'pack-1',
            messageIds: [86522023],
            cost: 1,
          },
        },
      }),
    );

    const result = await adapter.send('50003181890144', ['+989123456789'], 'Hello');

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('86522023');
    expect(mockHttpService.post).toHaveBeenCalledWith(
      'https://api.sms.ir/v1/send/bulk',
      {
        lineNumber: 50003181890144,
        messageText: 'Hello',
        mobiles: ['09123456789'],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-API-KEY': 'test-smsir-key',
        },
      },
    );
  });

  it('treats body status !== 1 as failure even on HTTP 200', async () => {
    mockHttpService.post.mockReturnValue(
      of({
        status: 200,
        data: { status: 102, message: 'اعتبار کافی نمیباشد' },
      }),
    );

    const result = await adapter.send('50003181890144', ['09123456789'], 'Hello');

    expect(result.success).toBe(false);
    expect(result.error).toContain('اعتبار');
  });

  it('maps 401 auth failure without throwing', async () => {
    mockHttpService.post.mockReturnValue(
      throwError(() => ({
        response: { status: 401, data: { status: 10, message: 'کلید نامعتبر' } },
        message: 'Request failed',
      })),
    );

    const result = await adapter.send('50003181890144', ['09123456789'], 'Hello');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/authentication|کلید|نامعتبر/i);
  });

  it('maps 429 rate limit without throwing', async () => {
    mockHttpService.post.mockReturnValue(
      throwError(() => ({
        response: { status: 429, data: { status: 20, message: 'تعداد درخواست بیشتر از حد مجاز' } },
        message: 'Request failed',
      })),
    );

    const result = await adapter.send('50003181890144', ['09123456789'], 'Hello');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/rate limit|حد مجاز/i);
  });

  it('rejects invalid phones', async () => {
    const result = await adapter.send('50003181890144', ['123'], 'Hello');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No valid');
    expect(mockHttpService.post).not.toHaveBeenCalled();
  });

  it('normalizes common IR phone formats to 09…', () => {
    expect(adapter.normalizeMobileTo09('+989123456789')).toBe('09123456789');
    expect(adapter.normalizeMobileTo09('989123456789')).toBe('09123456789');
    expect(adapter.normalizeMobileTo09('09123456789')).toBe('09123456789');
    expect(adapter.normalizeMobileTo09('9123456789')).toBe('09123456789');
    expect(adapter.normalizeMobileTo09('bad')).toBeNull();
  });
});
