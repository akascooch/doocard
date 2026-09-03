import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

const EDGE_BASE_URL = 'https://edge.ippanel.com';
const EDGE_SEND_PATH = '/v1/api/send';

export interface EdgeSendResult {
  success: boolean;
}

/**
 * IPPANEL Edge adapter for customer registration SMS only.
 * Isolated from existing Faraz/adapter flows.
 */
@Injectable()
export class FarazEdgeAdapter {
  private readonly logger = new Logger(FarazEdgeAdapter.name);

  constructor(private readonly httpService: HttpService) {}

  /**
   * Send SMS via Edge API. Never throws.
   */
  async send(
    apiKey: string,
    fromNumber: string,
    recipients: string[],
    message: string,
  ): Promise<EdgeSendResult> {
    if (!apiKey || !fromNumber || !recipients?.length || !message) {
      this.logger.warn('Edge send skipped: missing apiKey, fromNumber, recipients or message');
      return { success: false };
    }

    const masked = recipients.map((r) => (r.length >= 4 ? `***${r.slice(-4)}` : '****')).join(', ');
    const url = `${EDGE_BASE_URL}${EDGE_SEND_PATH}`;

    try {
      this.logger.log(`📤 [Edge] Sending to ${masked}`);
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            sending_type: 'webservice',
            from_number: fromNumber,
            message,
            params: {
              recipients,
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: apiKey,
            },
          },
        ),
      );
      const data = response?.data;
      if (!data || data.status !== 'success') {
        this.logger.error(
          `[Edge] Provider error for ${masked} status=${response?.status} providerStatus=${data?.status}`,
        );
        return { success: false };
      }
      this.logger.log(`✅ [Edge] Sent to ${masked}`);
      return { success: true };
    } catch (error: any) {
      const status = error?.response?.status;
      const providerStatus = error?.response?.data?.status;
      this.logger.error(`❌ [Edge] Failed for ${masked} status=${status} providerStatus=${providerStatus}`);
      return { success: false };
    }
  }
}
