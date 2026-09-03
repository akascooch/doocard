import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FarazSmsSendService } from './faraz-sms-send.service';
import { SmsNotificationPolicyService } from './sms-notification-policy.service';
import { SMS_ALWAYS_CC_PHONES } from './sms-always-cc';
import { normalizeIranMobile } from '../common/utils/phone.util';

export interface SmsOutboundResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
}

export type SmsOutboundParams = {
  eventKey: string;
  phone: string;
  message: string;
  dedupeKey: string;
  appointmentId?: number;
  /** In-app template key for reports (not sms.ir id) */
  templateKey?: string | null;
  /**
   * When true, skip SMS_ALWAYS_CC fanout.
   * Use when recipients already are (or include) the always-CC list.
   */
  skipAlwaysCc?: boolean;
};

/**
 * Policy-gated, deduped SMS send. Never throws.
 * Uses FarazSmsSendService (smsir|faraz). Records SmsEvent when possible.
 * Always fans out to SMS_ALWAYS_CC_PHONES when a send is attempted.
 */
@Injectable()
export class SmsOutboundService {
  private readonly logger = new Logger(SmsOutboundService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly policy: SmsNotificationPolicyService,
    private readonly smsSend: FarazSmsSendService,
  ) {}

  /**
   * Send one SMS if env+policy allow and dedupeKey not already SENT.
   * Also CC hard-coded admin phones (same message; separate dedupe keys).
   */
  async sendIfAllowed(params: SmsOutboundParams): Promise<SmsOutboundResult> {
    const primary = await this.sendOne(params);
    if (!params.skipAlwaysCc) {
      await this.fanoutAlwaysCc(params);
    }
    return primary;
  }

  /**
   * Core single-recipient send (no CC recursion).
   */
  private async sendOne(params: SmsOutboundParams): Promise<SmsOutboundResult> {
    try {
      if (this.configService.get<string>('SMS_ENABLED', 'false') !== 'true') {
        await this.recordNonSend(params, 'SKIPPED', 'SMS_ENABLED off');
        return { success: false, skipped: true, reason: 'SMS_ENABLED off' };
      }

      const allowed = await this.policy.isSmsAllowed(params.eventKey);
      if (!allowed) {
        await this.recordNonSend(params, 'BLOCKED', 'policy denied');
        return { success: false, skipped: true, reason: 'policy denied' };
      }

      if (!params.phone?.trim() || !params.message?.trim()) {
        await this.recordNonSend(params, 'SKIPPED', 'missing phone/message');
        return { success: false, skipped: true, reason: 'missing phone/message' };
      }

      const existing = await this.prisma.smsEvent.findUnique({
        where: { dedupeKey: params.dedupeKey },
      });
      if (existing && existing.status === 'SENT') {
        this.logger.debug(`SMS dedupe hit ${params.dedupeKey}`);
        return { success: true, skipped: true, reason: 'already sent' };
      }

      // Reserve dedupe row (PENDING) to reduce double-send races
      try {
        if (!existing) {
          await this.prisma.smsEvent.create({
            data: {
              dedupeKey: params.dedupeKey,
              eventKey: params.eventKey,
              templateKey: params.templateKey ?? null,
              to: this.maskForStore(params.phone),
              message: params.message.slice(0, 500),
              status: 'PENDING',
              appointmentId: params.appointmentId ?? null,
              attempts: 0,
            },
          });
        }
      } catch (e: any) {
        // Unique race: another worker reserved — re-check
        const raced = await this.prisma.smsEvent.findUnique({
          where: { dedupeKey: params.dedupeKey },
        });
        if (raced?.status === 'SENT') {
          return { success: true, skipped: true, reason: 'already sent' };
        }
      }

      const result = await this.smsSend.sendSingle(params.phone, params.message);

      await this.prisma.smsEvent.updateMany({
        where: { dedupeKey: params.dedupeKey },
        data: {
          status: result.success ? 'SENT' : 'FAILED',
          templateKey: params.templateKey ?? undefined,
          providerResp: result.error
            ? JSON.stringify({ error: result.error })
            : undefined,
          lastAttemptAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      return {
        success: result.success,
        reason: result.error,
      };
    } catch (err: any) {
      this.logger.error(`SMS outbound error: ${err?.message || 'unknown'}`);
      return { success: false, reason: err?.message || 'unexpected' };
    }
  }

  /**
   * Copy every outbound SMS attempt to hard-coded admin phones.
   * Skips when env/policy would block; skips if CC phone == primary recipient.
   */
  private async fanoutAlwaysCc(params: SmsOutboundParams): Promise<void> {
    try {
      if (this.configService.get<string>('SMS_ENABLED', 'false') !== 'true') {
        return;
      }
      if (!(await this.policy.isSmsAllowed(params.eventKey))) {
        return;
      }
      if (!params.message?.trim()) {
        return;
      }

      const primaryNorm = normalizeIranMobile(params.phone) || params.phone?.trim();

      for (const ccPhone of SMS_ALWAYS_CC_PHONES) {
        const ccNorm = normalizeIranMobile(ccPhone) || ccPhone;
        if (primaryNorm && ccNorm && primaryNorm === ccNorm) {
          continue;
        }
        const last4 = ccNorm.replace(/\D/g, '').slice(-4) || 'xxxx';
        await this.sendOne({
          ...params,
          phone: ccNorm,
          dedupeKey: `${params.dedupeKey}:cc:${last4}`,
        });
      }
    } catch (err: any) {
      this.logger.error(
        `SMS always-CC fanout error: ${err?.message || 'unknown'}`,
      );
    }
  }

  /** Store masked phone only in SmsEvent.to for privacy. */
  private maskForStore(phone: string): string {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.length < 4) return '****';
    return `***${digits.slice(-4)}`;
  }

  /**
   * Persist SKIPPED/BLOCKED so appointment-centric reports show why SMS did not go out.
   * Never overwrites an existing SENT row.
   */
  private async recordNonSend(
    params: SmsOutboundParams,
    status: 'SKIPPED' | 'BLOCKED',
    reason: string,
  ): Promise<void> {
    try {
      const existing = await this.prisma.smsEvent.findUnique({
        where: { dedupeKey: params.dedupeKey },
      });
      if (existing?.status === 'SENT') return;

      const data = {
        eventKey: params.eventKey,
        templateKey: params.templateKey ?? null,
        to: this.maskForStore(params.phone || 'unknown'),
        message: (params.message || '').slice(0, 500) || null,
        status,
        providerResp: JSON.stringify({ error: reason }),
        appointmentId: params.appointmentId ?? null,
        lastAttemptAt: new Date(),
        attempts: (existing?.attempts ?? 0) + 1,
      };

      if (existing) {
        await this.prisma.smsEvent.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await this.prisma.smsEvent.create({
          data: {
            dedupeKey: params.dedupeKey,
            ...data,
          },
        });
      }
    } catch (err: any) {
      this.logger.debug(
        `SMS non-send log skipped: ${err?.message || 'unknown'}`,
      );
    }
  }
}
