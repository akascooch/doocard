import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmsServiceEnhanced } from './sms.service.enhanced';
import { PrismaService } from '../prisma/prisma.service';
import { FarazSdkAdapter } from './adapters/faraz-sdk.adapter';
import { FarazHttpAdapter } from './adapters/faraz-http.adapter';

describe('SmsServiceEnhanced', () => {
  let service: SmsServiceEnhanced;
  let prismaService: PrismaService;
  let sdkAdapter: FarazSdkAdapter;
  let httpAdapter: FarazHttpAdapter;

  const mockPrismaService = {
    smsEvent: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        SMS_ORIGINATOR: '1000',
        SMS_API_KEY: 'test-api-key',
        SMS_API_URL: 'https://api.farazsms.com',
      };
      return config[key] || defaultValue;
    }),
  };

  const mockSdkAdapter = {
    isConfigured: jest.fn(() => true),
    send: jest.fn(),
  };

  const mockHttpAdapter = {
    isConfigured: jest.fn(() => false),
    send: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsServiceEnhanced,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: FarazSdkAdapter,
          useValue: mockSdkAdapter,
        },
        {
          provide: FarazHttpAdapter,
          useValue: mockHttpAdapter,
        },
      ],
    }).compile();

    service = module.get<SmsServiceEnhanced>(SmsServiceEnhanced);
    prismaService = module.get<PrismaService>(PrismaService);
    sdkAdapter = module.get<FarazSdkAdapter>(FarazSdkAdapter);
    httpAdapter = module.get<FarazHttpAdapter>(FarazHttpAdapter);

    // Initialize the service (simulate onModuleInit)
    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizePhoneNumber', () => {
    it('should normalize Iranian phone numbers to E.164 format', () => {
      const inputs = [
        '09123456789',
        '+989123456789',
        '989123456789',
        '0912 345 6789',
      ];

      inputs.forEach((input) => {
        const result = service.normalizePhoneNumber(input);
        expect(result).toMatch(/^\+989\d{9}$/);
      });
    });

    it('should return null for invalid phone numbers', () => {
      const invalidNumbers = ['123', 'abc', ''];
      
      invalidNumbers.forEach((num) => {
        const result = service.normalizePhoneNumber(num);
        expect(result).toBeNull();
      });
    });
  });

  describe('sendSms', () => {
    it('should send SMS successfully using SDK adapter', async () => {
      const recipients = ['+989123456789', '+989987654321'];
      const message = 'Test message';
      const appointmentId = 1;

      mockSdkAdapter.send.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
        providerResponse: { status: 'sent' },
      });

      mockPrismaService.smsEvent.createMany.mockResolvedValue({ count: 2 });

      const result = await service.sendSms(recipients, message, appointmentId);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(mockSdkAdapter.send).toHaveBeenCalledWith(
        '1000',
        expect.any(Array),
        message,
      );
      expect(mockPrismaService.smsEvent.createMany).toHaveBeenCalled();
    });

    it('should handle SMS sending failure', async () => {
      const recipients = ['+989123456789'];
      const message = 'Test message';

      mockSdkAdapter.send.mockResolvedValue({
        success: false,
        error: 'API error',
      });

      mockPrismaService.smsEvent.createMany.mockResolvedValue({ count: 1 });

      const result = await service.sendSms(recipients, message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
      expect(mockPrismaService.smsEvent.createMany).toHaveBeenCalled();
    });

    it('should return error when no adapter is available', async () => {
      // Mock no adapter configured
      mockSdkAdapter.isConfigured.mockReturnValue(false);
      mockHttpAdapter.isConfigured.mockReturnValue(false);

      // Re-initialize service
      service.onModuleInit();

      const result = await service.sendSms(['+989123456789'], 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should filter out invalid phone numbers', async () => {
      const recipients = ['+989123456789', 'invalid', '123'];
      const message = 'Test message';

      mockSdkAdapter.send.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
      });

      mockPrismaService.smsEvent.createMany.mockResolvedValue({ count: 1 });

      const result = await service.sendSms(recipients, message);

      expect(result.success).toBe(true);
      // Should only send to valid numbers
      expect(mockSdkAdapter.send).toHaveBeenCalledWith(
        '1000',
        expect.arrayContaining([expect.stringMatching(/^\+989\d{9}$/)]),
        message,
      );
    });

    it('should return error when no valid phone numbers', async () => {
      const recipients = ['invalid', '123'];
      const message = 'Test message';

      const result = await service.sendSms(recipients, message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid phone numbers');
      expect(mockSdkAdapter.send).not.toHaveBeenCalled();
    });
  });

  describe('getSmsEventsByAppointment', () => {
    it('should retrieve SMS events for an appointment', async () => {
      const appointmentId = 1;
      const mockEvents = [
        {
          id: 1,
          appointmentId,
          to: '+989123456789',
          status: 'SENT',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.smsEvent.findMany.mockResolvedValue(mockEvents);

      const result = await service.getSmsEventsByAppointment(appointmentId);

      expect(result).toEqual(mockEvents);
      expect(mockPrismaService.smsEvent.findMany).toHaveBeenCalledWith({
        where: { appointmentId },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getAllSmsEvents', () => {
    it('should retrieve all SMS events with limit', async () => {
      const mockEvents = [
        {
          id: 1,
          to: '+989123456789',
          status: 'SENT',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.smsEvent.findMany.mockResolvedValue(mockEvents);

      const result = await service.getAllSmsEvents(50);

      expect(result).toEqual(mockEvents);
      expect(mockPrismaService.smsEvent.findMany).toHaveBeenCalledWith({
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getPendingSmsEvents', () => {
    it('should retrieve pending SMS events with less than 3 attempts', async () => {
      const mockEvents = [
        {
          id: 1,
          to: '+989123456789',
          status: 'PENDING',
          attempts: 1,
          createdAt: new Date(),
        },
      ];

      mockPrismaService.smsEvent.findMany.mockResolvedValue(mockEvents);

      const result = await service.getPendingSmsEvents();

      expect(result).toEqual(mockEvents);
      expect(mockPrismaService.smsEvent.findMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          attempts: {
            lt: 3,
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('updateSmsEventStatus', () => {
    it('should update SMS event status', async () => {
      const eventId = 1;
      const status = 'SENT';
      const providerResp = { messageId: 'msg-123' };

      const mockUpdatedEvent = {
        id: eventId,
        status,
        providerResp: JSON.stringify(providerResp),
        lastAttemptAt: expect.any(Date),
        attempts: 2,
      };

      mockPrismaService.smsEvent.update.mockResolvedValue(mockUpdatedEvent);

      const result = await service.updateSmsEventStatus(
        eventId,
        status,
        providerResp,
      );

      expect(result).toEqual(mockUpdatedEvent);
      expect(mockPrismaService.smsEvent.update).toHaveBeenCalledWith({
        where: { id: eventId },
        data: {
          status,
          providerResp: JSON.stringify(providerResp),
          lastAttemptAt: expect.any(Date),
          attempts: {
            increment: 1,
          },
        },
      });
    });
  });
});

