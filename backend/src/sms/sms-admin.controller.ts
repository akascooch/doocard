import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PrismaService } from '../prisma/prisma.service';
import { SmsNotificationPolicyService } from './sms-notification-policy.service';
import { SmsOutboundService } from './sms-outbound.service';
import { SmsTemplateService, SMS_TEMPLATE_KEYS } from './sms-template.service';
import { SMS_EVENT_KEYS } from './sms-event-keys';
import {
  deriveEntityIds,
  deriveRecipientType,
  deriveTemplateKey,
  summarizeProviderResp,
} from './sms-report.util';

class UpdateSmsRuleDto {
  @IsString()
  eventKey: string;

  @IsBoolean()
  smsEnabled: boolean;
}

class TestSmsDto {
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  content?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

/** Simple in-memory rate limit for custom/test sends (per admin). */
const customSendBucket = new Map<number, { count: number; windowStart: number }>();
const CUSTOM_SEND_LIMIT = 5;
const CUSTOM_SEND_WINDOW_MS = 60_000;

@Controller('sms/admin')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Roles('ADMIN')
export class SmsAdminController {
  constructor(
    private readonly policy: SmsNotificationPolicyService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly smsOutbound: SmsOutboundService,
    private readonly templates: SmsTemplateService,
  ) {}

  @Get('status')
  async getStatus() {
    const provider = (this.config.get<string>('SMS_PROVIDER', 'faraz') || 'faraz')
      .trim()
      .toLowerCase();
    const enabled = this.config.get<string>('SMS_ENABLED', 'false') === 'true';
    const hasApiKey = !!(this.config.get<string>('SMS_API_KEY', '') || '').trim();
    const hasLine = !!(
      this.config.get<string>('SMS_LINE_NUMBER', '') ||
      this.config.get<string>('SMS_SENDER_NUMBER', '') ||
      ''
    ).trim();

    return {
      provider,
      smsEnabledEnv: enabled,
      apiKeyConfigured: hasApiKey,
      lineConfigured: hasLine,
      architecture: 'free-text-bulk',
      note: 'شناسه قالب پنل sms.ir در این معماری استفاده نمی‌شود',
    };
  }

  @Get('rules')
  async listRules() {
    return this.policy.listRules();
  }

  @Patch('rules')
  async updateRule(@Body() dto: UpdateSmsRuleDto) {
    const row = await this.policy.setSmsEnabled(dto.eventKey, dto.smsEnabled);
    return {
      eventKey: row.eventKey,
      label: row.label,
      smsEnabled: row.smsEnabled,
      updatedAt: row.updatedAt,
    };
  }

  @Get('templates')
  async listTemplates(
    @Query('q') q?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.templates.list({
      q,
      includeInactive: includeInactive === 'true' || includeInactive === '1',
    });
  }

  @Get('templates/catalog')
  catalog() {
    return this.templates.catalogKeys();
  }

  @Get('templates/:templateKey')
  async getTemplate(@Param('templateKey') templateKey: string) {
    const list = await this.templates.list({ includeInactive: true });
    const row = list.find((t) => t.templateKey === templateKey);
    if (!row) {
      return this.templates.getByKey(templateKey);
    }
    return row;
  }

  /** DB-only update — never sends SMS. */
  @Patch('templates/:templateKey')
  async updateTemplate(
    @Param('templateKey') templateKey: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    const updated = await this.templates.update(templateKey, {
      content: dto.content,
      isActive: dto.isActive,
      description: dto.description,
    });
    return {
      templateKey: updated.name,
      content: updated.content,
      description: updated.description,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt,
      sent: false,
      note: 'فقط ذخیره قالب — هیچ پیامکی ارسال نشد',
    };
  }

  @Get('events')
  async listEvents(
    @Query('limit') limit?: string,
    @Query('appointmentId') appointmentId?: string,
  ) {
    const take = Math.min(Math.max(parseInt(limit || '50', 10) || 50, 1), 200);
    const apptId = appointmentId ? parseInt(appointmentId, 10) : undefined;
    const rows = await this.prisma.smsEvent.findMany({
      where: Number.isFinite(apptId) ? { appointmentId: apptId } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        eventKey: true,
        dedupeKey: true,
        to: true,
        status: true,
        attempts: true,
        lastAttemptAt: true,
        createdAt: true,
        appointmentId: true,
        message: true,
        providerResp: true,
        templateKey: true,
      },
    });

    return rows.map((ev) => {
      const entities = deriveEntityIds(ev.dedupeKey);
      const provider = summarizeProviderResp(ev.providerResp);
      return {
        id: ev.id,
        eventKey: ev.eventKey,
        eventType: ev.eventKey,
        dedupeKey: ev.dedupeKey,
        templateKey: deriveTemplateKey({
          templateKey: ev.templateKey,
          dedupeKey: ev.dedupeKey,
          eventKey: ev.eventKey,
        }),
        recipientType: deriveRecipientType(ev.dedupeKey),
        to: ev.to,
        toMasked: ev.to,
        status: ev.status,
        appointmentId: ev.appointmentId,
        customerUserId: entities.customerUserId ?? null,
        adminId: entities.adminId ?? null,
        attempts: ev.attempts,
        createdAt: ev.createdAt,
        lastAttemptAt: ev.lastAttemptAt,
        message: ev.message,
        messagePreview: (ev.message || '').slice(0, 120),
        providerError: provider.error || null,
        rejectReason:
          ev.status === 'FAILED'
            ? provider.error || 'provider_failed'
            : ev.status === 'SKIPPED' || ev.status === 'BLOCKED'
              ? provider.error || 'skipped'
              : null,
      };
    });
  }

  @Get('events/by-appointment/:appointmentId')
  async eventsByAppointment(@Param('appointmentId') appointmentId: string) {
    const id = parseInt(appointmentId, 10);
    if (!Number.isFinite(id)) return { appointmentId: null, items: [] };

    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        employeeId: true,
        customer: { select: { userId: true, user: { select: { phone: true } } } },
        employee: { select: { userId: true, user: { select: { phone: true } } } },
      },
    });

    const items = await this.listEvents('100', String(id));
    const customer = items.find((i) => i.recipientType === 'CUSTOMER');
    const barber = items.find((i) => i.recipientType === 'BARBER');

    const missingPhoneReason = (side: 'customer' | 'barber') => {
      if (!appointment) return 'appointment_not_found';
      const phone =
        side === 'customer'
          ? appointment.customer?.user?.phone
          : appointment.employee?.user?.phone;
      if (!phone) return 'missing_recipient_phone';
      return 'no_event_recorded';
    };

    return {
      appointmentId: id,
      customerId: appointment?.customerId ?? null,
      barberId: appointment?.employeeId ?? null,
      customerSms: customer
        ? { status: customer.status, reason: customer.rejectReason }
        : { status: 'MISSING', reason: missingPhoneReason('customer') },
      barberSms: barber
        ? { status: barber.status, reason: barber.rejectReason }
        : { status: 'MISSING', reason: missingPhoneReason('barber') },
      items: items.map((i) => ({
        ...i,
        customerId: appointment?.customerId ?? null,
        barberId: appointment?.employeeId ?? null,
      })),
    };
  }

  @Post('test')
  async sendTest(@Req() req: any, @Body() dto: TestSmsDto) {
    return this.sendControlled(req, dto, 'test');
  }

  @Post('send-custom')
  async sendCustom(@Req() req: any, @Body() dto: TestSmsDto) {
    return this.sendControlled(req, dto, 'custom');
  }

  private assertRateLimit(adminId: number) {
    const now = Date.now();
    const bucket = customSendBucket.get(adminId) || {
      count: 0,
      windowStart: now,
    };
    if (now - bucket.windowStart > CUSTOM_SEND_WINDOW_MS) {
      bucket.count = 0;
      bucket.windowStart = now;
    }
    if (bucket.count >= CUSTOM_SEND_LIMIT) {
      throw new HttpException(
        'محدودیت ارسال: حداکثر ۵ پیامک در دقیقه',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    bucket.count += 1;
    customSendBucket.set(adminId, bucket);
  }

  private async sendControlled(
    req: any,
    dto: TestSmsDto,
    mode: 'test' | 'custom',
  ) {
    const adminId = Number(req?.user?.id || req?.user?.sub || 0);
    this.assertRateLimit(adminId || 0);

    const phone = (dto.phone || '').trim();
    if (!/^09\d{9}$/.test(phone.replace(/\D/g, '').replace(/^98/, '0'))) {
      const digits = phone.replace(/\D/g, '');
      const normalized =
        digits.length === 10 && digits.startsWith('9')
          ? `0${digits}`
          : digits.startsWith('98') && digits.length >= 12
            ? `0${digits.slice(2)}`
            : digits;
      if (!/^09\d{9}$/.test(normalized)) {
        return { success: false, error: 'شماره موبایل نامعتبر است' };
      }
      dto.phone = normalized;
    } else {
      dto.phone = phone.replace(/\D/g, '').replace(/^98/, '0');
      if (dto.phone.length === 10) dto.phone = `0${dto.phone}`;
    }

    let message = (dto.message || '').trim();
    const templateKey =
      mode === 'test'
        ? SMS_TEMPLATE_KEYS.SMS_TEST
        : SMS_TEMPLATE_KEYS.SMS_CUSTOM;
    if (!message) {
      if (mode === 'custom') {
        return { success: false, error: 'متن پیام سفارشی لازم است' };
      }
      message = await this.templates.renderByKey(templateKey, {});
    }
    if (message.length > 500) {
      return { success: false, error: 'متن پیام بیش از ۵۰۰ کاراکتر است' };
    }

    const eventKey =
      mode === 'test' ? SMS_EVENT_KEYS.ADMIN_TEST : SMS_EVENT_KEYS.ADMIN_CUSTOM;
    // Unique dedupe per attempt so intentional repeats are allowed; still logged.
    const dedupeKey = `${mode === 'test' ? 'sms.test' : 'custom'}:${adminId}:${dto.phone.slice(-4)}:${Date.now()}`;

    const result = await this.smsOutbound.sendIfAllowed({
      eventKey,
      phone: dto.phone,
      message,
      dedupeKey,
      templateKey,
    });

    return {
      success: result.success,
      skipped: result.skipped || false,
      error: result.reason || null,
      eventKey,
      templateKey,
      via: 'SmsOutboundService',
    };
  }
}
