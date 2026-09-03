import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  SmsAdapterInterface,
  SmsResponse,
} from '../interfaces/sms-adapter.interface';

/** Official sms.ir REST base (https://sms.ir/rest-api/) */
const SMS_IR_BULK_URL = 'https://api.sms.ir/v1/send/bulk';

/**
 * sms.ir HTTP adapter — free-text bulk send.
 * Auth: X-API-KEY. Success: HTTP 2xx and body.status === 1.
 * Never throws; returns SmsResponse.
 */
@Injectable()
export class SmsIrHttpAdapter implements SmsAdapterInterface {
  private readonly logger = new Logger(SmsIrHttpAdapter.name);
  private readonly apiKey: string;
  private readonly lineNumberRaw: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('SMS_API_KEY', '') || '';
    this.lineNumberRaw =
      this.configService.get<string>('SMS_LINE_NUMBER', '') ||
      this.configService.get<string>('SMS_SENDER_NUMBER', '') ||
      '';
  }

  isConfigured(): boolean {
    return !!this.apiKey.trim() && this.parseLineNumber(this.lineNumberRaw) !== null;
  }

  /**
   * @param originator - Optional override line number; falls back to env SMS_LINE_NUMBER / SMS_SENDER_NUMBER
   * @param recipients - Phones in any common IR format; normalized to 09xxxxxxxxx
   */
  async send(
    originator: string,
    recipients: string[],
    message: string,
  ): Promise<SmsResponse> {
    if (!this.apiKey.trim()) {
      return { success: false, error: 'sms.ir API key not configured' };
    }

    const lineNumber = this.parseLineNumber(originator) ?? this.parseLineNumber(this.lineNumberRaw);
    if (lineNumber === null) {
      return { success: false, error: 'sms.ir line number not configured' };
    }

    if (!message?.trim()) {
      return { success: false, error: 'Empty SMS message' };
    }

    const mobiles = recipients
      .map((r) => this.normalizeMobileTo09(r))
      .filter((m): m is string => m !== null);

    if (mobiles.length === 0) {
      return { success: false, error: 'No valid phone numbers' };
    }

    if (mobiles.length > 100) {
      return { success: false, error: 'Too many recipients (max 100)' };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          SMS_IR_BULK_URL,
          {
            lineNumber,
            messageText: message,
            mobiles,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'X-API-KEY': this.apiKey,
            },
          },
        ),
      );

      const httpOk = response?.status >= 200 && response?.status < 300;
      const body = response?.data;
      const providerStatus = body?.status;
      const ok = httpOk && providerStatus === 1;

      if (ok) {
        const messageId =
          body?.data?.messageIds?.[0] != null
            ? String(body.data.messageIds[0])
            : body?.data?.packId
              ? String(body.data.packId)
              : undefined;
        this.logger.log(
          `sms.ir send OK recipients=${mobiles.length} messageId=${messageId ?? 'n/a'}`,
        );
        return {
          success: true,
          messageId,
          providerResponse: {
            status: providerStatus,
            message: body?.message,
            packId: body?.data?.packId,
            messageIds: body?.data?.messageIds,
            cost: body?.data?.cost,
          },
        };
      }

      const errMsg =
        body?.message ||
        (providerStatus != null ? `sms.ir status ${providerStatus}` : 'sms.ir send failed');
      this.logger.error(
        `sms.ir send failed HTTP=${response?.status ?? 'n/a'} status=${providerStatus ?? 'n/a'} message=${errMsg}`,
      );
      return {
        success: false,
        error: errMsg,
        providerResponse: {
          status: providerStatus,
          message: body?.message,
        },
      };
    } catch (err: any) {
      const httpStatus = err?.response?.status;
      const data = err?.response?.data;
      const errMsg =
        data?.message ||
        (httpStatus === 401
          ? 'sms.ir authentication failed'
          : httpStatus === 429
            ? 'sms.ir rate limit exceeded'
            : err?.message || 'sms.ir request failed');

      this.logger.error(
        `sms.ir request error HTTP=${httpStatus ?? 'n/a'} message=${errMsg}`,
      );

      return {
        success: false,
        error: errMsg,
        providerResponse: data
          ? { status: data.status, message: data.message }
          : undefined,
      };
    }
  }

  /** Digits-only line id as number, or null if invalid. */
  parseLineNumber(raw: string): number | null {
    if (!raw || typeof raw !== 'string') return null;
    const digits = raw.trim().replace(/\D/g, '');
    if (!digits) return null;
    const n = Number(digits);
    if (!Number.isSafeInteger(n) || n <= 0) return null;
    return n;
  }

  /**
   * Normalize to 09xxxxxxxxx (11 digits) for sms.ir bulk examples.
   * Accepts +98…, 98…, 09…, 9….
   */
  normalizeMobileTo09(phone: string): string | null {
    if (!phone || typeof phone !== 'string') return null;
    let digits = phone.trim().replace(/\D/g, '');
    if (!digits) return null;

    if (digits.startsWith('98') && digits.length >= 12) {
      digits = `0${digits.slice(2)}`;
    } else if (digits.startsWith('9') && digits.length === 10) {
      digits = `0${digits}`;
    }

    if (digits.length === 11 && digits.startsWith('09')) {
      return digits;
    }
    return null;
  }
}
