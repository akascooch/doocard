import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsAdapterInterface, SmsResponse } from '../interfaces/sms-adapter.interface';

/**
 * FarazSMS SDK Adapter
 * Uses the @aspianet/faraz-sms package
 */
@Injectable()
export class FarazSdkAdapter implements SmsAdapterInterface {
  private readonly logger = new Logger(FarazSdkAdapter.name);
  private farazSMS: any;
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('SMS_API_KEY', '');
    
    if (this.apiKey) {
      try {
        // Dynamic import of FarazSMS SDK
        const { FarazSMS } = require('@aspianet/faraz-sms');
        this.farazSMS = new FarazSMS(this.apiKey);
        this.logger.log('✅ FarazSMS SDK initialized successfully');
      } catch (error) {
        this.logger.warn('⚠️  FarazSMS SDK not available, will fall back to HTTP adapter');
        this.logger.debug(`SDK Error: ${error.message}`);
      }
    }
  }

  isConfigured(): boolean {
    return !!this.farazSMS && !!this.apiKey;
  }

  async send(
    originator: string,
    recipients: string[],
    message: string,
  ): Promise<SmsResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'FarazSMS SDK not configured or available',
      };
    }

    try {
      this.logger.log(`📤 Sending SMS via SDK to ${recipients.length} recipient(s)`);
      this.logger.debug(`Originator: ${originator}`);
      this.logger.debug(`Message: ${message.substring(0, 50)}...`);

      // Use the SDK's farazSendSMS method
      const response = await this.farazSMS.farazSendSMS(
        originator,
        recipients,
        message,
      );

      this.logger.log('✅ SMS sent successfully via SDK');
      this.logger.debug(`Response: ${JSON.stringify(response)}`);

      return {
        success: true,
        messageId: response?.messageId || response?.data?.messageId,
        providerResponse: response,
      };
    } catch (error) {
      this.logger.error('❌ Failed to send SMS via SDK', error.stack);
      return {
        success: false,
        error: error.message,
        providerResponse: error.response?.data,
      };
    }
  }
}

