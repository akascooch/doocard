import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FarazSdkAdapter } from './adapters/faraz-sdk.adapter';
import { FarazHttpAdapter } from './adapters/faraz-http.adapter';
import { SmsAdapterInterface, SmsResponse } from './interfaces/sms-adapter.interface';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Enhanced SMS Service
 * Supports multiple adapters with automatic fallback
 */
@Injectable()
export class SmsServiceEnhanced implements OnModuleInit {
  private readonly logger = new Logger(SmsServiceEnhanced.name);
  private adapter: SmsAdapterInterface;
  private readonly originator: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private sdkAdapter: FarazSdkAdapter,
    private httpAdapter: FarazHttpAdapter,
  ) {
    this.originator = this.configService.get<string>('SMS_ORIGINATOR', '');
  }

  onModuleInit() {
    // Choose adapter: SDK first, fallback to HTTP
    if (this.sdkAdapter.isConfigured()) {
      this.adapter = this.sdkAdapter;
      this.logger.log('🚀 Using FarazSMS SDK Adapter');
    } else if (this.httpAdapter.isConfigured()) {
      this.adapter = this.httpAdapter;
      this.logger.log('🚀 Using FarazSMS HTTP Adapter (fallback)');
    } else {
      this.logger.warn('⚠️  No SMS adapter configured. SMS functionality disabled.');
    }

    if (!this.originator) {
      this.logger.warn('⚠️  SMS_ORIGINATOR not configured');
    }
  }

  /**
   * Normalize phone number to E.164 format
   * @param phoneNumber - Input phone number
   * @returns Normalized phone number or null if invalid
   */
  normalizePhoneNumber(phoneNumber: string): string | null {
    try {
      // Remove any whitespace
      const cleaned = phoneNumber.replace(/\s+/g, '');

      // Check if it's a valid Iranian phone number
      if (isValidPhoneNumber(cleaned, 'IR')) {
        const parsed = parsePhoneNumber(cleaned, 'IR');
        return parsed.number; // Returns E.164 format like +989123456789
      }

      // Try parsing without country code assumption
      if (isValidPhoneNumber(cleaned)) {
        const parsed = parsePhoneNumber(cleaned);
        return parsed.number;
      }

      this.logger.warn(`Invalid phone number: ${phoneNumber}`);
      return null;
    } catch (error) {
      this.logger.error(`Failed to normalize phone number ${phoneNumber}:`, error.message);
      return null;
    }
  }

  /**
   * Send SMS to recipients
   * @param recipients - Array of phone numbers
   * @param message - SMS message
   * @param appointmentId - Optional appointment ID for tracking
   * @returns SMS response
   */
  async sendSms(
    recipients: string[],
    message: string,
    appointmentId?: number,
  ): Promise<SmsResponse> {
    if (!this.adapter) {
      this.logger.error('❌ No SMS adapter available');
      return {
        success: false,
        error: 'SMS service not configured',
      };
    }

    if (!this.originator) {
      this.logger.error('❌ SMS originator not configured');
      return {
        success: false,
        error: 'SMS originator not configured',
      };
    }

    // Normalize all phone numbers
    const normalizedRecipients = recipients
      .map((phone) => this.normalizePhoneNumber(phone))
      .filter((phone) => phone !== null);

    if (normalizedRecipients.length === 0) {
      this.logger.error('❌ No valid phone numbers to send SMS');
      return {
        success: false,
        error: 'No valid phone numbers',
      };
    }

    this.logger.log(
      `📤 Sending SMS to ${normalizedRecipients.length} recipient(s)${
        appointmentId ? ` for appointment ${appointmentId}` : ''
      }`,
    );

    try {
      const response = await this.adapter.send(
        this.originator,
        normalizedRecipients,
        message,
      );

      // Log to database
      await this.logSmsEvents(
        normalizedRecipients,
        message,
        response.success ? 'SENT' : 'FAILED',
        appointmentId,
        response.providerResponse,
        response.error,
      );

      return response;
    } catch (error) {
      this.logger.error('❌ Unexpected error sending SMS:', error.stack);

      // Log failure
      await this.logSmsEvents(
        normalizedRecipients,
        message,
        'FAILED',
        appointmentId,
        null,
        error.message,
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Log SMS events to database
   * @param recipients - Phone numbers
   * @param message - SMS message
   * @param status - Status (PENDING/SENT/FAILED)
   * @param appointmentId - Optional appointment ID
   * @param providerResp - Provider response
   * @param error - Error message if failed
   */
  private async logSmsEvents(
    recipients: string[],
    message: string,
    status: string,
    appointmentId?: number,
    providerResp?: any,
    error?: string,
  ): Promise<void> {
    try {
      const events = recipients.map((phone) => ({
        appointmentId,
        to: phone,
        message,
        status,
        providerResp: providerResp ? JSON.stringify(providerResp) : null,
        attempts: status === 'FAILED' ? 1 : 0,
        lastAttemptAt: new Date(),
      }));

      await this.prisma.smsEvent.createMany({
        data: events,
      });

      this.logger.debug(`📝 Logged ${events.length} SMS event(s) to database`);
    } catch (dbError) {
      this.logger.error('❌ Failed to log SMS events to database:', dbError.message);
    }
  }

  /**
   * Get SMS events for an appointment
   * @param appointmentId - Appointment ID
   * @returns SMS events
   */
  async getSmsEventsByAppointment(appointmentId: number) {
    return this.prisma.smsEvent.findMany({
      where: { appointmentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all SMS events
   * @param limit - Maximum number of events to return
   * @returns SMS events
   */
  async getAllSmsEvents(limit = 100) {
    return this.prisma.smsEvent.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get pending SMS events that need retry
   * @returns Pending SMS events
   */
  async getPendingSmsEvents() {
    return this.prisma.smsEvent.findMany({
      where: {
        status: 'PENDING',
        attempts: {
          lt: 3, // Less than 3 attempts
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Update SMS event status
   * @param eventId - Event ID
   * @param status - New status
   * @param providerResp - Provider response
   */
  async updateSmsEventStatus(
    eventId: number,
    status: string,
    providerResp?: any,
  ) {
    return this.prisma.smsEvent.update({
      where: { id: eventId },
      data: {
        status,
        providerResp: providerResp ? JSON.stringify(providerResp) : undefined,
        lastAttemptAt: new Date(),
        attempts: {
          increment: 1,
        },
      },
    });
  }
}

