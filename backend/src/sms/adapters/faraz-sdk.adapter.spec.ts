import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FarazSdkAdapter } from './faraz-sdk.adapter';

// Mock the FarazSMS SDK
jest.mock('@aspianet/faraz-sms', () => ({
  FarazSMS: jest.fn().mockImplementation(() => ({
    farazSendSMS: jest.fn(),
  })),
}));

describe('FarazSdkAdapter', () => {
  let adapter: FarazSdkAdapter;
  let mockConfigService: any;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          SMS_API_KEY: 'test-api-key',
        };
        return config[key] || defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarazSdkAdapter,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    adapter = module.get<FarazSdkAdapter>(FarazSdkAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should return true if configured', () => {
    expect(adapter.isConfigured()).toBe(true);
  });

  it('should return false if not configured', () => {
    mockConfigService.get.mockReturnValue('');
    const newAdapter = new FarazSdkAdapter(mockConfigService);
    expect(newAdapter.isConfigured()).toBe(false);
  });
});

