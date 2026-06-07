import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SmsAdapterInterface, SmsResponse } from '../interfaces/sms-adapter.interface';

/**
 * FarazSMS HTTP Adapter
 * Direct HTTP API integration as fallback
 * Base URL: https://api.farazsms.com or https://edge.ippanel.com/v1
 */
@Injectable()
export class FarazHttpAdapter implements SmsAdapterInterface {
  private readonly logger = new Logger(FarazHttpAdapter.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('SMS_API_KEY', '');
    this.baseUrl = this.configService.get<string>(
      'SMS_API_URL',
      'https://api.farazsms.com',
    );

    if (this.apiKey) {
      this.logger.log(`✅ FarazSMS HTTP Adapter initialized with base URL: ${this.baseUrl}`);
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey && !!this.baseUrl;
  }

  async send(
    originator: string,
    recipients: string[],
    message: string,
  ): Promise<SmsResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'FarazSMS HTTP Adapter not configured',
      };
    }

    try {
      this.logger.log(`📤 Sending SMS via HTTP to ${recipients.length} recipient(s)`);
      this.logger.debug(`API URL: ${this.baseUrl}`);
      this.logger.debug(`Originator: ${originator}`);

      // FarazSMS/IPPanel API endpoint for sending SMS
      const endpoint = `${this.baseUrl}/api/v1/sms/send`;

      const payload = {
        originator,
        recipients,
        message,
      };

      const response = await firstValueFrom(
        this.httpService.post(endpoint, payload, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `AccessKey ${this.apiKey}`,
          },
        }),
      );

      this.logger.log('✅ SMS sent successfully via HTTP');
      this.logger.debug(`Response: ${JSON.stringify(response.data)}`);

      return {
        success: true,
        messageId: response.data?.messageId || response.data?.data?.messageId,
        providerResponse: response.data,
      };
    } catch (error) {
      this.logger.error('❌ Failed to send SMS via HTTP', error.stack);
      
      const errorMessage = error.response?.data?.message || error.message;
      const errorDetails = error.response?.data;

      this.logger.error(`Error details: ${JSON.stringify(errorDetails)}`);

      return {
        success: false,
        error: errorMessage,
        providerResponse: errorDetails,
      };
    }
  }
}

