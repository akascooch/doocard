import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { FarazHttpAdapter } from './faraz-http.adapter';
import { of, throwError } from 'rxjs';

describe('FarazHttpAdapter', () => {
  let adapter: FarazHttpAdapter;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        SMS_API_KEY: 'test-api-key',
        SMS_API_URL: 'https://api.farazsms.com',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarazHttpAdapter,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    adapter = module.get<FarazHttpAdapter>(FarazHttpAdapter);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should return true if configured', () => {
    expect(adapter.isConfigured()).toBe(true);
  });

  it('should send SMS successfully via HTTP', async () => {
    const originator = '1000';
    const recipients = ['+989123456789'];
    const message = 'Test message';

    const mockResponse = {
      data: {
        success: true,
        messageId: 'msg-123',
      },
    };

    mockHttpService.post.mockReturnValue(of(mockResponse));

    const result = await adapter.send(originator, recipients, message);

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-123');
    expect(mockHttpService.post).toHaveBeenCalledWith(
      'https://api.farazsms.com/api/v1/sms/send',
      {
        originator,
        recipients,
        message,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'AccessKey test-api-key',
        },
      },
    );
  });

  it('should handle HTTP errors', async () => {
    const originator = '1000';
    const recipients = ['+989123456789'];
    const message = 'Test message';

    const mockError = {
      response: {
        data: {
          message: 'API Error',
        },
      },
      message: 'HTTP Error',
    };

    mockHttpService.post.mockReturnValue(throwError(() => mockError));

    const result = await adapter.send(originator, recipients, message);

    expect(result.success).toBe(false);
    expect(result.error).toBe('API Error');
  });

  it('should return error if not configured', async () => {
    mockConfigService.get.mockReturnValue('');
    const newAdapter = new FarazHttpAdapter(httpService, configService);

    const result = await newAdapter.send('1000', ['+989123456789'], 'Test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });
});

