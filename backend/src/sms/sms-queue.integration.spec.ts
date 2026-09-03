import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { BullModule, getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { SmsQueueProcessor } from './sms-queue.processor';
import { SmsServiceEnhanced } from './sms.service.enhanced';
import { FarazSdkAdapter } from './adapters/faraz-sdk.adapter';
import { FarazHttpAdapter } from './adapters/faraz-http.adapter';
import { HttpModule } from '@nestjs/axios';

describe('SmsQueue Integration Tests', () => {
  let module: TestingModule;
  let processor: SmsQueueProcessor;
  let prismaService: PrismaService;
  let smsService: SmsServiceEnhanced;
  let smsQueue: Queue;

  const mockPrismaService = {
    appointment: {
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    smsEvent: {
      createMany: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockQueue = {
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        HttpModule,
      ],
      providers: [
        SmsQueueProcessor,
        SmsServiceEnhanced,
        FarazSdkAdapter,
        FarazHttpAdapter,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: getQueueToken('sms'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    processor = module.get<SmsQueueProcessor>(SmsQueueProcessor);
    prismaService = module.get<PrismaService>(PrismaService);
    smsService = module.get<SmsServiceEnhanced>(SmsServiceEnhanced);
    smsQueue = module.get<Queue>(getQueueToken('sms'));
  });

  afterAll(async () => {
    await module.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('SMS Queue Processor', () => {
    it('should process appointment SMS job successfully', async () => {
      const appointmentId = 1;
      const mockAppointment = {
        id: appointmentId,
        scheduledAt: new Date('2025-11-05T10:00:00Z'),
        services: [
          {
            serviceName: 'اصلاح صورت',
            priceAtBooking: 100000,
            durationMin: 30,
          },
        ],
        customer: {
          user: {
            name: 'علی احمدی',
            phone: '09123456789',
          },
        },
        employee: {
          user: {
            name: 'حسن رضایی',
            phone: '09987654321',
          },
        },
      };

      const mockManagers = [
        {
          name: 'مدیر اول',
          phone: '09111111111',
        },
      ];

      mockPrismaService.appointment.findUnique.mockResolvedValue(
        mockAppointment,
      );
      mockPrismaService.user.findMany.mockResolvedValue(mockManagers);
      mockPrismaService.smsEvent.createMany.mockResolvedValue({ count: 2 });
      mockPrismaService.smsEvent.updateMany.mockResolvedValue({ count: 2 });

      // Mock SMS service to return success
      jest.spyOn(smsService, 'sendSms').mockResolvedValue({
        success: true,
        messageId: 'msg-123',
        providerResponse: { status: 'sent' },
      });

      const job = {
        data: { appointmentId },
        attemptsMade: 0,
      } as any;

      const result = await processor.handleSmsJob(job);

      expect(result.success).toBe(true);
      expect(mockPrismaService.appointment.findUnique).toHaveBeenCalledWith({
        where: { id: appointmentId },
        include: {
          customer: {
            include: {
              user: true,
            },
          },
          employee: {
            include: {
              user: true,
            },
          },
        },
      });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          role: 'MANAGER',
          phone: {
            not: null,
          },
        },
        select: {
          phone: true,
          name: true,
        },
      });

      expect(smsService.sendSms).toHaveBeenCalledWith(
        expect.any(Array),
        expect.stringContaining('نوبت جدید ثبت شد'),
        appointmentId,
      );

      expect(mockPrismaService.smsEvent.updateMany).toHaveBeenCalledWith({
        where: {
          appointmentId,
          status: 'PENDING',
        },
        data: {
          status: 'SENT',
          providerResp: expect.any(String),
          lastAttemptAt: expect.any(Date),
        },
      });
    });

    it('should handle appointment not found', async () => {
      const appointmentId = 999;
      mockPrismaService.appointment.findUnique.mockResolvedValue(null);

      const job = {
        data: { appointmentId },
        attemptsMade: 0,
      } as any;

      await expect(processor.handleSmsJob(job)).rejects.toThrow(
        'Appointment 999 not found',
      );
    });

    it('should handle no recipients gracefully', async () => {
      const appointmentId = 2;
      const mockAppointment = {
        id: appointmentId,
        scheduledAt: new Date(),
        services: [],
        customer: {
          user: {
            name: 'علی احمدی',
            phone: null, // No phone
          },
        },
        employee: null, // No employee
      };

      mockPrismaService.appointment.findUnique.mockResolvedValue(
        mockAppointment,
      );
      mockPrismaService.user.findMany.mockResolvedValue([]); // No managers

      const job = {
        data: { appointmentId },
        attemptsMade: 0,
      } as any;

      const result = await processor.handleSmsJob(job);

      expect(result.success).toBe(true);
      expect(result.message).toContain('No recipients');
    });

    it('should retry on SMS failure', async () => {
      const appointmentId = 3;
      const mockAppointment = {
        id: appointmentId,
        scheduledAt: new Date(),
        services: [{ serviceName: 'خدمت تست' }],
        customer: {
          user: {
            name: 'تست',
            phone: '09123456789',
          },
        },
        employee: {
          user: {
            name: 'آرایشگر',
            phone: '09987654321',
          },
        },
      };

      mockPrismaService.appointment.findUnique.mockResolvedValue(
        mockAppointment,
      );
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.smsEvent.createMany.mockResolvedValue({ count: 2 });

      // Mock SMS service to return failure
      jest.spyOn(smsService, 'sendSms').mockResolvedValue({
        success: false,
        error: 'API error',
      });

      const job = {
        data: { appointmentId },
        attemptsMade: 0,
      } as any;

      await expect(processor.handleSmsJob(job)).rejects.toThrow('API error');

      // Should not mark as failed on first attempt
      expect(mockPrismaService.smsEvent.updateMany).not.toHaveBeenCalled();
    });

    it('should mark as failed after max attempts', async () => {
      const appointmentId = 4;
      const mockAppointment = {
        id: appointmentId,
        scheduledAt: new Date(),
        services: [],
        customer: {
          user: {
            name: 'تست',
            phone: '09123456789',
          },
        },
        employee: null,
      };

      mockPrismaService.appointment.findUnique.mockResolvedValue(
        mockAppointment,
      );
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.smsEvent.createMany.mockResolvedValue({ count: 1 });
      mockPrismaService.smsEvent.updateMany.mockResolvedValue({ count: 1 });

      // Mock SMS service to return failure
      jest.spyOn(smsService, 'sendSms').mockResolvedValue({
        success: false,
        error: 'Max retries exceeded',
      });

      const job = {
        data: { appointmentId },
        attemptsMade: 2, // Last attempt
      } as any;

      await expect(processor.handleSmsJob(job)).rejects.toThrow();

      // Should mark as failed
      expect(mockPrismaService.smsEvent.updateMany).toHaveBeenCalledWith({
        where: {
          appointmentId,
          status: 'PENDING',
        },
        data: {
          status: 'FAILED',
          providerResp: expect.any(String),
          lastAttemptAt: expect.any(Date),
          attempts: {
            increment: 1,
          },
        },
      });
    });
  });

  describe('Phone Number Normalization', () => {
    beforeAll(() => {
      smsService.onModuleInit();
    });

    it('should normalize various Iranian phone number formats', () => {
      const testCases = [
        { input: '09123456789', expected: '+989123456789' },
        { input: '+989123456789', expected: '+989123456789' },
        { input: '989123456789', expected: '+989123456789' },
        { input: '0912 345 6789', expected: '+989123456789' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = smsService.normalizePhoneNumber(input);
        expect(result).toBe(expected);
      });
    });
  });
});

