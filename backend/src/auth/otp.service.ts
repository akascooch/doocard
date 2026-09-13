import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { SmsIrVerifyAdapter } from '../sms/adapters/smsir-verify.adapter';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { UserRole } from '@prisma/client';

const OTP_TTL_MS = 2 * 60 * 1000;
const OTP_WINDOW_MS = 15 * 60 * 1000;
const OTP_MAX_PER_WINDOW = 3;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_LENGTH = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly verifyAdapter: SmsIrVerifyAdapter,
    private readonly authService: AuthService,
  ) {}

  async requestOtp(dto: RequestOtpDto): Promise<{ ok: true; expiresInSeconds: number }> {
    const phone = dto.phone;
    const purpose = dto.purpose || 'LOGIN';
    const canSendLive = this.verifyAdapter.isConfigured() && this.isSmsEnabled();

    if (!canSendLive && !this.allowDevOtpFallback()) {
      this.logger.warn(
        'OTP request rejected: verify provider is not configured or SMS_ENABLED is not true',
      );
      throw new ServiceUnavailableException({
        message: 'سرویس ارسال کد تأیید پیکربندی نشده است',
        error: 'SERVICE_UNAVAILABLE',
      });
    }

    const latest = await this.prisma.otpChallenge.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (latest) {
      const elapsed = Date.now() - latest.createdAt.getTime();
      if (elapsed < OTP_RESEND_COOLDOWN_MS) {
        const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
        throw new HttpException(
          `لطفاً ${retryAfterSeconds} ثانیه دیگر برای ارسال مجدد صبر کنید.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const windowStart = new Date(Date.now() - OTP_WINDOW_MS);
    const recentCount = await this.prisma.otpChallenge.count({
      where: { phone, createdAt: { gte: windowStart } },
    });
    if (recentCount >= OTP_MAX_PER_WINDOW) {
      throw new HttpException(
        'تعداد درخواست کد بیش از حد مجاز است. ۱۵ دقیقه دیگر تلاش کنید.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.otpChallenge.updateMany({
      where: { phone, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const ttlMs = this.resolveTtlMs();
    const code = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
    const codeHash = this.hashCode(phone, code);
    const expiresAt = new Date(Date.now() + ttlMs);

    const challenge = await this.prisma.otpChallenge.create({
      data: { phone, codeHash, purpose, expiresAt },
    });

    if (!canSendLive) {
      this.logger.warn(
        `[OTP-DEV] SMS skipped (SMS_ENABLED/keys). phone=***${phone.slice(-4)} code=${code}`,
      );
      return { ok: true, expiresInSeconds: Math.round(ttlMs / 1000) };
    }

    const sent = await this.verifyAdapter.sendVerifyCode(phone, code);
    if (!sent.success) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      this.logger.warn(`OTP send failed phone=***${phone.slice(-4)} error=${sent.error ?? 'n/a'}`);
      throw new ServiceUnavailableException({
        message: 'ارسال پیامک تأیید ناموفق بود. بعداً تلاش کنید.',
        error: 'SERVICE_UNAVAILABLE',
      });
    }

    this.logger.log(`OTP requested phone=***${phone.slice(-4)} purpose=${purpose}`);
    return { ok: true, expiresInSeconds: Math.round(ttlMs / 1000) };
  }

  async verifyOtp(
    dto: VerifyOtpDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const phone = dto.phone;
    const purpose = dto.purpose || 'LOGIN';
    const now = new Date();

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge || challenge.expiresAt < now) {
      throw new UnauthorizedException('کد تأیید نامعتبر یا منقضی است');
    }

    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: now },
      });
      throw new UnauthorizedException('تعداد تلاش برای این کد تمام شده است');
    }

    const incomingHash = this.hashCode(phone, dto.code);
    const matches = this.safeEqualHex(challenge.codeHash, incomingHash);

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: {
        attempts: { increment: 1 },
        ...(matches ? { consumedAt: now } : {}),
      },
    });

    if (!matches) {
      throw new UnauthorizedException('کد تأیید نادرست است');
    }

    const existing = await this.prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const isNewUser = !existing;
    const user = existing ?? (await this.createCustomer(phone, dto.name));
    const session = await this.authService.issueSession(
      user,
      ipAddress,
      userAgent,
      dto.rememberMe,
    );
    return { ...session, isNewUser };
  }

  private async createCustomer(phone: string, name?: string) {

    const displayName = name?.trim() && name.trim().length >= 2
      ? name.trim()
      : `مشتری ${phone.slice(-4)}`;
    const hashedPassword = await bcrypt.hash(randomBytes(32).toString('hex'), 12);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: displayName,
          phone,
          password: hashedPassword,
          role: UserRole.CUSTOMER,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const defaultEmployee = await tx.employee.findFirst({
        where: { isActive: true, user: { role: 'EMPLOYEE' } },
        orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
      });

      await tx.customer.create({
        data: {
          userId: user.id,
          preferredEmployeeId: defaultEmployee?.id ?? null,
        },
      });

      return user;
    });
  }

  private hashCode(phone: string, code: string): string {
    const pepper =
      this.configService.get<string>('SMS_OTP_PEPPER')?.trim() ||
      this.configService.get<string>('JWT_SECRET', '') ||
      'otp-pepper';
    return createHash('sha256').update(`${pepper}:${phone}:${code}`).digest('hex');
  }

  private safeEqualHex(a: string, b: string): boolean {
    try {
      const left = Buffer.from(a, 'hex');
      const right = Buffer.from(b, 'hex');
      if (left.length !== right.length) return false;
      return timingSafeEqual(left, right);
    } catch {
      return false;
    }
  }

  private resolveTtlMs(): number {
    const raw = this.configService.get<string>('SMS_OTP_TTL_SECONDS');
    const seconds = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(seconds) && seconds >= 60 && seconds <= 600) {
      return seconds * 1000;
    }
    return OTP_TTL_MS;
  }

  private isSmsEnabled(): boolean {
    return (this.configService.get<string>('SMS_ENABLED', '') || '').trim() === 'true';
  }

  /** Local Nest boot only. Test and production stay fail-closed (503) when SMS cannot be sent. */
  private allowDevOtpFallback(): boolean {
    const env = (
      this.configService.get<string>('NODE_ENV', '') ||
      process.env.NODE_ENV ||
      ''
    ).trim();
    return env === 'development';
  }
}
