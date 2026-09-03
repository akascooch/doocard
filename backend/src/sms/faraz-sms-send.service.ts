import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SmsIrHttpAdapter } from './adapters/smsir-http.adapter';

/**
 * Provider-agnostic single-SMS sender used by appointment + (optionally) customer flows.
 * Class name kept for DI stability with existing AppointmentsModule.
 * Never throws; returns { success, error? }. Masks phones in logs. Never logs API keys.
 */
export interface SendSingleResult {
  success: boolean;
  error?: string;
}

const EDGE_SEND_URL = 'https://edge.ippanel.com/v1/api/send';

@Injectable()
export class FarazSmsSendService {
  private readonly logger = new Logger(FarazSmsSendService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly smsIrAdapter: SmsIrHttpAdapter,
  ) {}

  /**
   * Send one SMS to one recipient.
   * Provider: SMS_PROVIDER=smsir|faraz (default faraz).
   * Requires SMS_ENABLED=true. Never throws.
   */
  async sendSingle(recipientPhone: string, message: string): Promise<SendSingleResult> {
    try {
      if (!this.isSmsEnabled()) {
        this.logger.warn('SMS not sent: SMS_ENABLED is not true');
        return { success: false, error: 'SMS disabled' };
      }

      const provider = this.getProvider();
      if (provider === 'smsir') {
        return await this.sendViaSmsIr(recipientPhone, message);
      }
      return await this.sendViaFaraz(recipientPhone, message);
    } catch (err: any) {
      this.logger.error(
        `SMS sendSingle unexpected error for ***${this.maskPhone(recipientPhone)}: ${err?.message || 'unknown'}`,
      );
      return { success: false, error: err?.message || 'Unexpected SMS error' };
    }
  }

  private isSmsEnabled(): boolean {
    return this.configService.get<string>('SMS_ENABLED', 'false') === 'true';
  }

  private getProvider(): 'smsir' | 'faraz' {
    const raw = (this.configService.get<string>('SMS_PROVIDER', 'faraz') || 'faraz')
      .trim()
      .toLowerCase();
    return raw === 'smsir' ? 'smsir' : 'faraz';
  }

  private async sendViaSmsIr(
    recipientPhone: string,
    message: string,
  ): Promise<SendSingleResult> {
    if (!this.smsIrAdapter.isConfigured()) {
      this.logger.warn('SMS not sent: sms.ir not configured (SMS_API_KEY / SMS_LINE_NUMBER)');
      return { success: false, error: 'SMS not configured' };
    }

    const line =
      this.configService.get<string>('SMS_LINE_NUMBER', '') ||
      this.configService.get<string>('SMS_SENDER_NUMBER', '') ||
      '';

    const response = await this.smsIrAdapter.send(line, [recipientPhone], message);
    if (response.success) {
      this.logger.log(`SMS sent via sms.ir to ***${this.maskPhone(recipientPhone)}`);
      return { success: true };
    }
    this.logger.error(
      `sms.ir send failed for ***${this.maskPhone(recipientPhone)}: ${response.error || 'unknown'}`,
    );
    return { success: false, error: response.error || 'sms.ir send failed' };
  }

  private async sendViaFaraz(
    recipientPhone: string,
    message: string,
  ): Promise<SendSingleResult> {
    const apiKey = this.configService.get<string>('SMS_API_KEY', '');
    const senderNumber = this.configService.get<string>('SMS_SENDER_NUMBER', '');

    if (!apiKey) {
      this.logger.warn('SMS not sent: SMS_API_KEY not configured');
      return { success: false, error: 'SMS not configured' };
    }

    if (!senderNumber || senderNumber.trim() === '') {
      this.logger.warn('SMS not sent: SMS_SENDER_NUMBER not configured');
      return { success: false, error: 'SMS not configured' };
    }

    const phone = this.normalizePhoneE164(recipientPhone);
    if (!phone) {
      this.logger.warn(
        `SMS not sent: invalid or unsupported phone format (masked: ***${this.maskPhone(recipientPhone)})`,
      );
      return { success: false, error: 'Invalid phone number' };
    }

    try {
      const sender = senderNumber.trim();
      const fromNumber = sender.startsWith('+') ? sender : `+98${sender}`;
      const body = {
        sending_type: 'webservice',
        from_number: fromNumber,
        message,
        params: {
          recipients: [phone],
        },
      };

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
      this.logger.warn(
        `[SMS diagnostic] status=${httpStatus} providerMessage=${errMsg} senderUsed=${senderUsed}`,
      );
      return { success: false, error: errMsg };
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const errMsg = data?.meta?.message || err?.message || 'Request failed';
      const senderUsed = senderNumber.trim();
      const safeBody = data ? { meta: data.meta, hasData: !!data.data } : undefined;
      this.logger.error(
        `SMS send failed for ***${this.maskPhone(phone)}: ${errMsg} (HTTP ${status ?? 'N/A'}) response: ${JSON.stringify(safeBody ?? {})}`,
      );
      this.logger.warn(
        `[SMS diagnostic] status=${status ?? 'N/A'} providerMessage=${errMsg} senderUsed=${senderUsed}`,
      );
      return { success: false, error: errMsg };
    }
  }

  private maskPhone(phone: string): string {
    if (!phone || typeof phone !== 'string') return '????';
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '????';
    return digits.slice(-4);
  }

  private normalizePhoneE164(phone: string): string | null {
    if (!phone || typeof phone !== 'string') return null;
    const trimmed = phone.trim();
    if (trimmed.startsWith('+98')) return trimmed;
    if (trimmed.startsWith('98') && trimmed.length >= 12) return `+${trimmed}`;
    if (trimmed.startsWith('09') && trimmed.length === 11) return `+98${trimmed.slice(1)}`;
    return null;
  }
}
