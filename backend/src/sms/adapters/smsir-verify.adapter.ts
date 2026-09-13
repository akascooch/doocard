import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { normalizeIranMobile } from '../../common/utils/phone.util';

const SMS_IR_VERIFY_URL = 'https://api.sms.ir/v1/send/verify';

export type SmsIrVerifyResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

/**
 * Independent sms.ir Verify adapter (OTP only).
 * POST /v1/send/verify with header `x-api-key` (not Bearer).
 * Does not use SmsOutboundService and never CCs extra recipients.
 */
@Injectable()
export class SmsIrVerifyAdapter {
  private readonly logger = new Logger(SmsIrVerifyAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    const apiKey = this.getApiKey();
    const templateId = this.getTemplateId();
    return !!apiKey && templateId !== null;
  }

  async sendVerifyCode(mobile: string, code: string): Promise<SmsIrVerifyResult> {
    const apiKey = this.getApiKey();
    const templateId = this.getTemplateId();
    if (!apiKey || templateId === null) {
      return { success: false, error: 'sms.ir verify is not configured' };
    }

    const normalized = normalizeIranMobile(mobile);
    if (!normalized) {
      return { success: false, error: 'invalid mobile for sms.ir verify' };
    }

    const paramName =
      this.configService.get<string>('SMS_IR_OTP_PARAM_NAME')?.trim() || 'CODE';

    const payload = {
      mobile: normalized,
      templateId: Number(templateId),
      parameters: [{ name: paramName, value: String(code) }],
    };

    try {
      const response = await axios.post(SMS_IR_VERIFY_URL, payload, {
        timeout: 15_000,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-api-key': apiKey,
        },
      });

      const httpOk = response?.status >= 200 && response?.status < 300;
      const body = response?.data;
      const providerStatus = body?.status;
      const ok = httpOk && (providerStatus === 1 || providerStatus === '1');
      if (ok) {
        const messageId =
          body?.data?.messageId != null
            ? String(body.data.messageId)
            : body?.messageId != null
              ? String(body.messageId)
              : undefined;
        this.logger.log(`sms.ir verify OK mobile=***${normalized.slice(-4)}`);
        return { success: true, messageId };
      }

      const errMsg = body?.message || `sms.ir verify status=${providerStatus ?? 'n/a'}`;
      this.logger.warn(
        `sms.ir verify rejected mobile=***${normalized.slice(-4)} http=${response?.status ?? 'n/a'} status=${providerStatus ?? 'n/a'} message=${errMsg}`,
      );
      return { success: false, error: errMsg };
    } catch (err: any) {
      const httpStatus = err?.response?.status;
      const data = err?.response?.data;
      const providerStatus = data?.status;
      const msg = data?.message || err?.message || 'sms.ir verify request failed';
      this.logger.error(
        `sms.ir verify error mobile=***${normalized.slice(-4)} http=${httpStatus ?? 'n/a'} status=${providerStatus ?? 'n/a'} message=${msg}`,
      );
      return { success: false, error: msg };
    }
  }

  private getApiKey(): string {
    const primary = this.configService.get<string>('SMS_API_KEY', '') || '';
    const alias = this.configService.get<string>('SMS_IR_API_KEY', '') || '';
    return (primary || alias).trim();
  }

  private getTemplateId(): number | null {
    const raw = String(this.configService.get<string>('SMS_IR_OTP_TEMPLATE_ID', '') || '').trim();
    if (!/^\d+$/.test(raw)) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
}
