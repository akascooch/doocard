import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { FarazEdgeAdapter } from './adapters/faraz-edge.adapter';

const MESSAGE_TEMPLATE =
  'دوکارد: {name} عزیز، به خانواده دوکارد خوش آمدید. برای رزرو نوبت به doocardbarbershop.com مراجعه کنید.';
const MAX_MESSAGE_LENGTH = 280;
const MAX_NAME_DISPLAY = 40;

/**
 * Isolated SMS for admin customer registration only.
 * Uses IPPANEL Edge and dedicated API key. Does not touch appointment SMS.
 */
@Injectable()
export class CustomerRegistrationSmsService {
  private readonly logger = new Logger(CustomerRegistrationSmsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly edgeAdapter: FarazEdgeAdapter,
  ) {}

  /**
   * Send welcome SMS. Best-effort only; never throws. Returns true if send attempted and succeeded.
   */
  async sendWelcome(name: string, phone: string): Promise<boolean> {
    const apiKey = this.configService.get<string>('SMS_CUSTOMER_API_KEY', '');
    const senderRaw = this.configService.get<string>('SMS_SENDER_NUMBER', '');
    if (!apiKey || !senderRaw) {
      this.logger.warn('[CustomerRegistration SMS] SMS_CUSTOMER_API_KEY or SMS_SENDER_NUMBER not set');
      return false;
    }

    const recipient = this.normalizePhoneToE164(phone);
    if (!recipient) {
      const masked = (phone || '').length >= 4 ? `***${(phone || '').slice(-4)}` : '****';
      this.logger.warn(`[CustomerRegistration SMS] Invalid phone ${masked}, not sent`);
      return false;
    }

    const fromNumber = this.normalizeSenderToE164(senderRaw);
    if (!fromNumber) {
      this.logger.warn('[CustomerRegistration SMS] Invalid sender number');
      return false;
    }

    const message = this.buildMessage(name);
    const masked = recipient.length >= 4 ? `***${recipient.slice(-4)}` : '****';

    try {
      const result = await this.edgeAdapter.send(apiKey, fromNumber, [recipient], message);
      if (result.success) {
        this.logger.log(`[CustomerRegistration SMS] sent to ${masked}`);
      }
      return result.success;
    } catch (err: any) {
      this.logger.error('[CustomerRegistration SMS] Error: ' + (err?.message || 'unknown'));
      return false;
    }
  }

  private buildMessage(name: string): string {
    const displayName = (name || '').trim();
    const firstWord = displayName ? displayName.split(/\s+/)[0] || '' : '';
    const namePart = firstWord.length > MAX_NAME_DISPLAY
      ? firstWord.slice(0, MAX_NAME_DISPLAY)
      : (firstWord || 'مشتری عزیز');
    const message = MESSAGE_TEMPLATE.replace('{name}', namePart);
    return message.length > MAX_MESSAGE_LENGTH ? message.slice(0, MAX_MESSAGE_LENGTH) : message;
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
