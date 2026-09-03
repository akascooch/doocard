import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_SMS_POLICY,
  SmsEventKey,
  SMS_EVENT_KEYS,
} from './sms-event-keys';
import { isSmsEventAllowed } from './sms-policy.util';

@Injectable()
export class SmsNotificationPolicyService implements OnModuleInit {
  private readonly logger = new Logger(SmsNotificationPolicyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureDefaults();
    } catch (err: any) {
      this.logger.warn(
        `SMS policy seed skipped: ${err?.message || 'unknown'} (run prisma migrate)`,
      );
    }
  }

  async ensureDefaults(): Promise<void> {
    for (const rule of DEFAULT_SMS_POLICY) {
      await this.prisma.smsNotificationRule.upsert({
        where: { eventKey: rule.eventKey },
        create: {
          eventKey: rule.eventKey,
          label: rule.label,
          smsEnabled: rule.smsEnabled,
        },
        update: {
          label: rule.label,
        },
      });
    }
  }

  /**
   * True only when policy allows the event (env SMS_ENABLED checked by callers/outbound).
   * Soft-fail: unknown keys → false.
   */
  async isSmsAllowed(eventKey: string): Promise<boolean> {
    return isSmsEventAllowed(this.prisma, eventKey);
  }

  async listRules() {
    await this.ensureDefaults();
    const rows = await this.prisma.smsNotificationRule.findMany({
      orderBy: { eventKey: 'asc' },
    });
    return rows.map((r) => ({
      eventKey: r.eventKey,
      label: r.label,
      smsEnabled: r.smsEnabled,
      updatedAt: r.updatedAt,
    }));
  }

  async setSmsEnabled(eventKey: string, smsEnabled: boolean) {
    const known = Object.values(SMS_EVENT_KEYS).includes(eventKey as SmsEventKey);
    if (!known) {
      throw new Error(`Unknown SMS event key: ${eventKey}`);
    }
    const def = DEFAULT_SMS_POLICY.find((r) => r.eventKey === eventKey);
    return this.prisma.smsNotificationRule.upsert({
      where: { eventKey },
      create: {
        eventKey,
        label: def?.label || eventKey,
        smsEnabled,
      },
      update: { smsEnabled },
    });
  }
}
