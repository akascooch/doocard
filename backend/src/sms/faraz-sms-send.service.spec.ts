import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { FarazSmsSendService } from './faraz-sms-send.service';
import { SmsIrHttpAdapter } from './adapters/smsir-http.adapter';

describe('FarazSmsSendService (provider routing)', () => {
  let service: FarazSmsSendService;
  let smsIrAdapter: { isConfigured: jest.Mock; send: jest.Mock };
  let httpService: { post: jest.Mock };
  let configValues: Record<string, string>;

  beforeEach(async () => {
    configValues = {
      SMS_ENABLED: 'true',
      SMS_PROVIDER: 'faraz',
      SMS_API_KEY: 'faraz-key',
      SMS_SENDER_NUMBER: '3000505',
      SMS_LINE_NUMBER: '50003181890144',
    };

    smsIrAdapter = {
      isConfigured: jest.fn().mockReturnValue(true),
      send: jest.fn(),
    };

    httpService = {
      post: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarazSmsSendService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) =>
              configValues[key] ?? defaultValue,
          },
        },
        { provide: HttpService, useValue: httpService },
        { provide: SmsIrHttpAdapter, useValue: smsIrAdapter },
      ],
    }).compile();

    service = module.get(FarazSmsSendService);
  });

  it('does not send when SMS_ENABLED is not true', async () => {
    configValues.SMS_ENABLED = 'false';
    const result = await service.sendSingle('09123456789', 'hi');
    expect(result.success).toBe(false);
    expect(result.error).toBe('SMS disabled');
    expect(httpService.post).not.toHaveBeenCalled();
    expect(smsIrAdapter.send).not.toHaveBeenCalled();
  });

  it('routes to Faraz Edge when SMS_PROVIDER=faraz', async () => {
    httpService.post.mockReturnValue(
      of({ status: 200, data: { meta: { status: true, message: 'ok' } } }),
    );

    const result = await service.sendSingle('09123456789', 'hi');

    expect(result.success).toBe(true);
    expect(httpService.post).toHaveBeenCalled();
    expect(smsIrAdapter.send).not.toHaveBeenCalled();
    const [url, body, opts] = httpService.post.mock.calls[0];
    expect(url).toBe('https://edge.ippanel.com/v1/api/send');
    expect(body.sending_type).toBe('webservice');
    expect(opts.headers.Authorization).toBe('faraz-key');
  });

  it('routes to sms.ir when SMS_PROVIDER=smsir', async () => {
    configValues.SMS_PROVIDER = 'smsir';
    smsIrAdapter.send.mockResolvedValue({ success: true, messageId: '1' });

    const result = await service.sendSingle('+989123456789', 'hi');

    expect(result.success).toBe(true);
    expect(smsIrAdapter.send).toHaveBeenCalledWith(
      '50003181890144',
      ['+989123456789'],
      'hi',
    );
    expect(httpService.post).not.toHaveBeenCalled();
  });

  it('returns soft failure when sms.ir is not configured', async () => {
    configValues.SMS_PROVIDER = 'smsir';
    smsIrAdapter.isConfigured.mockReturnValue(false);

    const result = await service.sendSingle('09123456789', 'hi');

    expect(result.success).toBe(false);
    expect(result.error).toBe('SMS not configured');
    expect(smsIrAdapter.send).not.toHaveBeenCalled();
  });

  it('never throws when sms.ir adapter rejects', async () => {
    configValues.SMS_PROVIDER = 'smsir';
    smsIrAdapter.send.mockRejectedValue(new Error('boom'));

    await expect(service.sendSingle('09123456789', 'hi')).resolves.toEqual({
      success: false,
      error: 'boom',
    });
  });
});
