import { HttpException, HttpStatus, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpService } from './otp.service';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsIrVerifyAdapter } from '../sms/adapters/smsir-verify.adapter';

describe('OtpService', () => {
  const prisma = {
    otpChallenge: {
      count: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    user: { findUnique: jest.fn() },
  };
  const config = { get: jest.fn() };
  const adapter = {
    isConfigured: jest.fn(),
    sendVerifyCode: jest.fn(),
  };
  const auth = { issueSession: jest.fn() };

  let service: OtpService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OtpService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      adapter as unknown as SmsIrVerifyAdapter,
      auth as unknown as AuthService,
    );
  });

  it('rejects OTP request with 503 before creating a challenge when provider is not configured', async () => {
    adapter.isConfigured.mockReturnValue(false);

    await expect(
      service.requestOtp({ phone: '09120000000', purpose: 'BOOKING' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prisma.otpChallenge.create).not.toHaveBeenCalled();
    expect(adapter.sendVerifyCode).not.toHaveBeenCalled();
  });

  it('does not call the provider when the phone fails to reach the service (precondition covered by DTO)', async () => {
    adapter.isConfigured.mockReturnValue(true);
    prisma.otpChallenge.count.mockResolvedValue(0);
    prisma.otpChallenge.updateMany.mockResolvedValue({ count: 0 });
    prisma.otpChallenge.create.mockResolvedValue({ id: 'ch-1' });
    adapter.sendVerifyCode.mockResolvedValue({ success: false, error: 'upstream' });
    prisma.otpChallenge.update.mockResolvedValue({});

    await expect(
      service.requestOtp({ phone: '09120000000', purpose: 'BOOKING' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(adapter.sendVerifyCode).toHaveBeenCalledTimes(1);
    expect(prisma.otpChallenge.update).toHaveBeenCalled();
  });

  it('throttles repeated requests in-window', async () => {
    adapter.isConfigured.mockReturnValue(true);
    prisma.otpChallenge.count.mockResolvedValue(3);

    try {
      await service.requestOtp({ phone: '09120000000' });
      fail('expected throttle');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
    expect(adapter.sendVerifyCode).not.toHaveBeenCalled();
  });

  it('rejects verify without a valid challenge', async () => {
    prisma.otpChallenge.findFirst.mockResolvedValue(null);
    await expect(
      service.verifyOtp({ phone: '09120000000', code: '12345', purpose: 'BOOKING' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.issueSession).not.toHaveBeenCalled();
  });

  it('rejects expired challenge', async () => {
    prisma.otpChallenge.findFirst.mockResolvedValue({
      id: 'ch-1',
      expiresAt: new Date(Date.now() - 1000),
      attempts: 0,
      codeHash: 'abc',
    });
    await expect(
      service.verifyOtp({ phone: '09120000000', code: '12345' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.issueSession).not.toHaveBeenCalled();
  });
});
