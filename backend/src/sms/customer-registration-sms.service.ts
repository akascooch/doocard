import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FarazEdgeAdapter } from './adapters/faraz-edge.adapter';
import { FarazSmsSendService } from './faraz-sms-send.service';
import { SmsOutboundService } from './sms-outbound.service';
import { SmsTemplateService } from './sms-template.service';
import { SMS_TEMPLATE_KEYS } from './sms-template.catalog';
import { SMS_EVENT_KEYS } from './sms-event-keys';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

const MAX_MESSAGE_LENGTH = 280;
const MAX_NAME_DISPLAY = 40;

export type CustomerSmsSource = 'self_register' | 'admin_create' | 'admin_quick_create';

/**
 * Customer registration SMS orchestration (welcome + preferred barber + admin alerts).
 * Soft-fail; never throws into business flows.
 */
@Injectable()
export class CustomerRegistrationSmsService {
  private readonly logger = new Logger(CustomerRegistrationSmsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly edgeAdapter: FarazEdgeAdapter,
    private readonly smsSendService: FarazSmsSendService,
    private readonly smsOutbound: SmsOutboundService,
    private readonly smsTemplates: SmsTemplateService,
  ) {}

  /**
   * Full new-customer SMS flow:
   * 1) welcome to customer
   * 2) notify preferred barber (if preferredEmployeeId set and has phone)
   * 3) alert each ADMIN user with phone (DB-driven)
   *
   * Fallback when no preferred employee: skip barber SMS only (welcome + admin still sent).
   */
  async handleNewCustomer(params: {
    name: string;
    phone: string;
    userId: number;
    source: CustomerSmsSource;
    preferredEmployeeId?: number | null;
  }): Promise<void> {
    try {
      const eventKey =
        params.source === 'self_register'
          ? SMS_EVENT_KEYS.CUSTOMER_REGISTERED
          : SMS_EVENT_KEYS.CUSTOMER_CREATED_BY_ADMIN;

      const welcomeMsg = await this.buildWelcomeMessage(params.name);
      await this.smsOutbound.sendIfAllowed({
        eventKey,
        phone: params.phone,
        message: welcomeMsg,
        dedupeKey: `customer.welcome:${params.userId}`,
        templateKey: SMS_TEMPLATE_KEYS.WELCOME_CUSTOMER,
      });

      await this.notifyPreferredBarber({
        eventKey,
        customerUserId: params.userId,
        customerName: params.name,
        customerPhone: params.phone,
        preferredEmployeeId: params.preferredEmployeeId,
      });

      const sourceLabel =
        params.source === 'self_register'
          ? 'ثبت‌نام مشتری'
          : params.source === 'admin_quick_create'
            ? 'ثبت سریع ادمین'
            : 'ثبت ادمین';

      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN', phone: { not: null } },
        select: { id: true, phone: true },
      });

      for (const admin of admins) {
        if (!admin.phone) continue;
        const adminMsg = await this.buildAdminMessage(
          params.name,
          params.phone,
          sourceLabel,
        );
        await this.smsOutbound.sendIfAllowed({
          eventKey,
          phone: admin.phone,
          message: adminMsg,
          dedupeKey: `customer.admin:${params.userId}:${admin.id}`,
          templateKey: SMS_TEMPLATE_KEYS.ADMIN_NEW_CUSTOMER,
        });
      }
    } catch (err: any) {
      this.logger.error(
        `[CustomerRegistration SMS] handleNewCustomer failed: ${err?.message || 'unknown'}`,
      );
    }
  }

  /**
   * @deprecated Prefer handleNewCustomer. Kept for tests/callers that only want welcome.
   */
  async sendWelcome(name: string, phone: string): Promise<boolean> {
    try {
      if (this.configService.get<string>('SMS_ENABLED', 'false') !== 'true') {
        this.logger.warn('[CustomerRegistration SMS] SMS_ENABLED is not true');
        return false;
      }

      const message = await this.buildWelcomeMessage(name);
      const provider = (
        this.configService.get<string>('SMS_PROVIDER', 'faraz') || 'faraz'
      )
        .trim()
        .toLowerCase();

      if (provider === 'smsir') {
        const result = await this.smsSendService.sendSingle(phone, message);
        return result.success;
      }

      return await this.sendViaFarazEdge(phone, message);
    } catch (err: any) {
      this.logger.error('[CustomerRegistration SMS] Error: ' + (err?.message || 'unknown'));
      return false;
    }
  }

  private async notifyPreferredBarber(params: {
    eventKey: string;
    customerUserId: number;
    customerName: string;
    customerPhone: string;
    preferredEmployeeId?: number | null;
  }): Promise<void> {
    if (params.preferredEmployeeId == null) {
      this.logger.debug(
        `[CustomerRegistration SMS] no preferred barber for user ${params.customerUserId}; skip barber SMS`,
      );
      return;
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: Number(params.preferredEmployeeId) },
      include: { user: { select: { id: true, phone: true, name: true } } },
    });

    const barberPhone = employee?.user?.phone;
    if (!employee?.isActive || !barberPhone) {
      this.logger.debug(
        `[CustomerRegistration SMS] preferred barber ${params.preferredEmployeeId} has no usable phone; skip`,
      );
      return;
    }

    const safeName = (params.customerName || 'مشتری').trim().slice(0, MAX_NAME_DISPLAY);
    const safePhone = (params.customerPhone || '').trim().slice(0, 20);
    const message = await this.smsTemplates.renderByKey(
      SMS_TEMPLATE_KEYS.NEW_CUSTOMER_BARBER,
      { name: safeName, phone: safePhone },
    );
    const trimmed =
      message.length > MAX_MESSAGE_LENGTH
        ? message.slice(0, MAX_MESSAGE_LENGTH)
        : message;

    await this.smsOutbound.sendIfAllowed({
      eventKey: params.eventKey,
      phone: barberPhone,
      message: trimmed,
      dedupeKey: `customer.barber:${params.customerUserId}:${employee.id}`,
      templateKey: SMS_TEMPLATE_KEYS.NEW_CUSTOMER_BARBER,
    });
  }

  private async sendViaFarazEdge(phone: string, message: string): Promise<boolean> {
    const apiKey = this.configService.get<string>('SMS_CUSTOMER_API_KEY', '');
    const senderRaw = this.configService.get<string>('SMS_SENDER_NUMBER', '');
    if (!apiKey || !senderRaw) {
      this.logger.warn(
        '[CustomerRegistration SMS] SMS_CUSTOMER_API_KEY or SMS_SENDER_NUMBER not set',
      );
      return false;
    }

    const recipient = this.normalizePhoneToE164(phone);
    if (!recipient) return false;

    const fromNumber = this.normalizeSenderToE164(senderRaw);
    if (!fromNumber) return false;

    const result = await this.edgeAdapter.send(apiKey, fromNumber, [recipient], message);
    return result.success;
  }

  private async buildWelcomeMessage(name: string): Promise<string> {
    const displayName = (name || '').trim();
    const firstWord = displayName ? displayName.split(/\s+/)[0] || '' : '';
    const namePart =
      firstWord.length > MAX_NAME_DISPLAY
        ? firstWord.slice(0, MAX_NAME_DISPLAY)
        : firstWord || 'مشتری عزیز';
    const message = await this.smsTemplates.renderByKey(
      SMS_TEMPLATE_KEYS.WELCOME_CUSTOMER,
      { name: namePart },
    );
    return message.length > MAX_MESSAGE_LENGTH
      ? message.slice(0, MAX_MESSAGE_LENGTH)
      : message;
  }

  private async buildAdminMessage(
    name: string,
    phone: string,
    source: string,
  ): Promise<string> {
    const safeName = (name || 'مشتری').trim().slice(0, MAX_NAME_DISPLAY);
    const safePhone = (phone || '').trim().slice(0, 20);
    const message = await this.smsTemplates.renderByKey(
      SMS_TEMPLATE_KEYS.ADMIN_NEW_CUSTOMER,
      { name: safeName, phone: safePhone, source },
    );
    return message.length > MAX_MESSAGE_LENGTH
      ? message.slice(0, MAX_MESSAGE_LENGTH)
      : message;
  }

  private normalizePhoneToE164(phone: string): string | null {
    try {
      const cleaned = (phone || '').replace(/\s+/g, '');
      if (!cleaned) return null;
      if (isValidPhoneNumber(cleaned, 'IR')) {
        return parsePhoneNumber(cleaned, 'IR').number;
      }
      if (isValidPhoneNumber(cleaned)) {
        return parsePhoneNumber(cleaned).number;
      }
      return null;
    } catch {
      return null;
    }
  }

  private normalizeSenderToE164(sender: string): string | null {
    try {
      const cleaned = (sender || '').replace(/\s+/g, '').replace(/^0+/, '');
      if (!cleaned) return null;
      if (cleaned.startsWith('+98')) {
        return isValidPhoneNumber(cleaned) ? parsePhoneNumber(cleaned).number : null;
      }
      if (cleaned.startsWith('+')) {
        return isValidPhoneNumber(cleaned) ? parsePhoneNumber(cleaned).number : null;
      }
      const withCountry = `+98${cleaned}`;
      return isValidPhoneNumber(withCountry) ? parsePhoneNumber(withCountry).number : null;
    } catch {
      return null;
    }
  }
}
