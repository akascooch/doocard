import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const SMS_IR_VERIFY_URL = 'https://api.sms.ir/v1/send/verify';

export type SmsIrVerifyResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

/**
 * Independent sms.ir Verify adapter (OTP only).
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

    const paramName =
      this.configService.get<string>('SMS_IR_OTP_PARAM_NAME')?.trim() || 'CODE';

    try {
      const response = await axios.post(
        SMS_IR_VERIFY_URL,
        {
          mobile,
          templateId,
          parameters: [{ name: paramName, value: code }],
        },
        {
          timeout: 15_000,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-API-KEY': apiKey,
            'x-api-key': apiKey,
          },
        },
      );

      const httpOk = response?.status >= 200 && response?.status < 300;
      const body = response?.data;
      const ok = httpOk && (body?.status === 1 || body?.status === '1');
      if (ok) {
        const messageId =
          body?.data?.messageId != null
            ? String(body.data.messageId)
            : body?.messageId != null
              ? String(body.messageId)
              : undefined;
        this.logger.log(`sms.ir verify OK mobile=***${mobile.slice(-4)}`);
        return { success: true, messageId };
      }

      const errMsg = body?.message || `sms.ir verify status=${body?.status ?? 'n/a'}`;
      this.logger.warn(`sms.ir verify failed mobile=***${mobile.slice(-4)}: ${errMsg}`);
      return { success: false, error: errMsg };
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message || 'sms.ir verify request failed';
      this.logger.error(
        `sms.ir verify error mobile=***${mobile.slice(-4)} http=${status ?? 'n/a'}: ${msg}`,
      );
      return { success: false, error: msg };
    }
  }

  private getApiKey(): string {
    return (this.configService.get<string>('SMS_API_KEY', '') || '').trim();
  }

  private getTemplateId(): number | null {
    const raw = this.configService.get<string>('SMS_IR_OTP_TEMPLATE_ID', '') || '';
    const parsed = parseInt(raw.trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
}
