import { HttpException, HttpStatus, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
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

  function mockConfig(overrides: Record<string, string> = {}) {
    const map: Record<string, string> = {
      SMS_ENABLED: 'true',
      NODE_ENV: 'test',
      SMS_OTP_TTL_SECONDS: '120',
      JWT_SECRET: 'test-secret',
      ...overrides,
    };
    config.get.mockImplementation((key: string, fallback?: string) => map[key] ?? fallback ?? '');
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig();
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

  it('in development logs the OTP and returns ok when SMS_ENABLED is false', async () => {
    mockConfig({ NODE_ENV: 'development', SMS_ENABLED: 'false' });
    adapter.isConfigured.mockReturnValue(true);
    prisma.otpChallenge.count.mockResolvedValue(0);
    prisma.otpChallenge.updateMany.mockResolvedValue({ count: 0 });
    prisma.otpChallenge.create.mockResolvedValue({ id: 'ch-dev' });

    const result = await service.requestOtp({ phone: '09120000000', purpose: 'BOOKING' });

    expect(result).toEqual({ ok: true, expiresInSeconds: 120 });
    expect(prisma.otpChallenge.create).toHaveBeenCalled();
    expect(adapter.sendVerifyCode).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('code');
  });

  it('in development logs the OTP and returns ok when keys are missing', async () => {
    mockConfig({ NODE_ENV: 'development', SMS_ENABLED: 'true' });
    adapter.isConfigured.mockReturnValue(false);
    prisma.otpChallenge.count.mockResolvedValue(0);
    prisma.otpChallenge.updateMany.mockResolvedValue({ count: 0 });
    prisma.otpChallenge.create.mockResolvedValue({ id: 'ch-dev-2' });

    const result = await service.requestOtp({ phone: '09120000000', purpose: 'LOGIN' });

    expect(result.ok).toBe(true);
    expect(adapter.sendVerifyCode).not.toHaveBeenCalled();
  });

  it.each(['', 'false', '0', 'TRUE', 'True', 'yes'])(
    'fail-closes in production when SMS_ENABLED=%j even if the adapter is configured',
    async (enabled) => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      mockConfig({ NODE_ENV: 'production', SMS_ENABLED: enabled });
      adapter.isConfigured.mockReturnValue(true);

      await expect(
        service.requestOtp({ phone: '09120000000', purpose: 'BOOKING' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(prisma.otpChallenge.create).not.toHaveBeenCalled();
      expect(adapter.sendVerifyCode).not.toHaveBeenCalled();
      const logged = warnSpy.mock.calls.map((call) => String(call[0])).join(' ');
      expect(logged).not.toMatch(/\bcode=\d{5}\b/);
      warnSpy.mockRestore();
    },
  );

  it('does not log OTP when NODE_ENV is staging or unknown', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    mockConfig({ NODE_ENV: 'staging', SMS_ENABLED: 'false' });
    adapter.isConfigured.mockReturnValue(true);

    await expect(
      service.requestOtp({ phone: '09120000000', purpose: 'BOOKING' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prisma.otpChallenge.create).not.toHaveBeenCalled();
    expect(warnSpy.mock.calls.map((call) => String(call[0])).join(' ')).not.toMatch(/\bcode=\d{5}\b/);
    warnSpy.mockRestore();
  });

  it('returns ok without the OTP after a live send', async () => {
    adapter.isConfigured.mockReturnValue(true);
    prisma.otpChallenge.count.mockResolvedValue(0);
    prisma.otpChallenge.updateMany.mockResolvedValue({ count: 0 });
    prisma.otpChallenge.create.mockResolvedValue({ id: 'ch-ok' });
    adapter.sendVerifyCode.mockResolvedValue({ success: true, messageId: '9' });

    const result = await service.requestOtp({ phone: '09120000000', purpose: 'BOOKING' });

    expect(result).toEqual({ ok: true, expiresInSeconds: 120 });
    expect(result).not.toHaveProperty('code');
    expect(adapter.sendVerifyCode).toHaveBeenCalledTimes(1);
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
