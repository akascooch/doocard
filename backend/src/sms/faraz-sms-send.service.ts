import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Minimal service: send a single SMS via IPPANEL Edge (FarazSMS) webservice/single API.
 * No business logic. Used only for appointment-created notifications.
 * Hardened: never throws, masked logging, strict phone normalization, exact endpoint/header.
 */
export interface SendSingleResult {
  success: boolean;
  error?: string;
}

// IPPANEL Edge: POST /v1/api/send with sending_type=webservice (official docs)
const EDGE_SEND_URL = 'https://edge.ippanel.com/v1/api/send';

@Injectable()
export class FarazSmsSendService {
  private readonly logger = new Logger(FarazSmsSendService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Send one SMS to one recipient. Uses SMS_API_KEY and SMS_SENDER_NUMBER from env.
   * Never throws; returns { success, error? } and logs failures with masked phone only.
   */
  async sendSingle(recipientPhone: string, message: string): Promise<SendSingleResult> {
    const apiKey = this.configService.get<string>('SMS_API_KEY', '');
    const senderNumber = this.configService.get<string>('SMS_SENDER_NUMBER', '');

    if (!apiKey) {
      this.logger.warn('SMS not sent: SMS_API_KEY not configured');
      return { success: false, error: 'SMS not configured' };
    }

    // Use sender EXACTLY as provided; no auto-prefix per requirement
    if (!senderNumber || senderNumber.trim() === '') {
      this.logger.warn('SMS not sent: SMS_SENDER_NUMBER not configured');
      return { success: false, error: 'SMS not configured' };
    }

    const phone = this.normalizePhone(recipientPhone);
    if (!phone) {
      this.logger.warn(`SMS not sent: invalid or unsupported phone format (masked: ***${this.maskPhone(recipientPhone)})`);
      return { success: false, error: 'Invalid phone number' };
    }

    try {
      const sender = senderNumber.trim();
      // API expects E.164 for from_number (e.g. +983000505); env may be "3000505"
      const fromNumber = sender.startsWith('+') ? sender : `+98${sender}`;
      const body = {
        sending_type: 'webservice',
        from_number: fromNumber,
        message,
        params: {
          recipients: [phone],
        },
      };

      // Header: Authorization: <SMS_API_KEY> — no Bearer prefix, exact casing
      const response = await firstValueFrom(
        this.httpService.post(EDGE_SEND_URL, body, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: apiKey,
          },
        }),
      );

      const ok = response?.data?.meta?.status === true;
      const httpStatus = response?.status;
      const senderUsed = fromNumber;

      if (ok) {
        this.logger.log(`SMS sent successfully to ***${this.maskPhone(phone)}`);
        return { success: true };
      }

      const errMsg = response?.data?.meta?.message || 'Unknown API error';
      this.logger.error(
        `SMS API error for ***${this.maskPhone(phone)}: ${errMsg} (HTTP ${response?.status}); body: ${JSON.stringify(response?.data?.meta ?? {})}`,
      );
      // Temporary diagnostic: HTTP status, provider message, sender (no API key, no full phone)
      this.logger.warn(
        `[SMS diagnostic] status=${httpStatus} providerMessage=${errMsg} senderUsed=${senderUsed}`,
      );
      return { success: false, error: errMsg };
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const errMsg = data?.meta?.message || err?.message || 'Request failed';
      const senderUsed = senderNumber.trim();
      // Log status and response body for debugging; never log API key or full phone
      const safeBody = data ? { meta: data.meta, hasData: !!data.data } : undefined;
      this.logger.error(
        `SMS send failed for ***${this.maskPhone(phone)}: ${errMsg} (HTTP ${status ?? 'N/A'}) response: ${JSON.stringify(safeBody ?? {})}`,
      );
      // Temporary diagnostic: HTTP status, provider message, sender (no API key, no full phone)
      this.logger.warn(
        `[SMS diagnostic] status=${status ?? 'N/A'} providerMessage=${errMsg} senderUsed=${senderUsed}`,
      );
      return { success: false, error: errMsg };
    }
  }

  /**
   * Mask phone for logs: last 4 digits only, no full number in logs
   */
  private maskPhone(phone: string): string {
    if (!phone || typeof phone !== 'string') return '????';
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '????';
    return digits.slice(-4);
  }

  /**
   * Normalize Iranian mobile for API. Single pass, idempotent.
   * +98 → as-is; 98... → +98...; 09... → +989...; else → null (skip send, no throw)
   */
  private normalizePhone(phone: string): string | null {
    if (!phone || typeof phone !== 'string') return null;
    const trimmed = phone.trim();
    if (trimmed.startsWith('+98')) return trimmed;
    if (trimmed.startsWith('98') && trimmed.length >= 12) return `+${trimmed}`;
    if (trimmed.startsWith('09') && trimmed.length === 11) return `+98${trimmed.slice(1)}`;
    // Unsupported format: do not attempt further conversion; skip sending
    return null;
  }
}
