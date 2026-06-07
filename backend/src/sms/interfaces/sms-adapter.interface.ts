/**
 * SMS Adapter Interface
 * Defines the contract for SMS service providers
 */
export interface SmsResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  providerResponse?: any;
}

export interface SmsAdapterInterface {
  /**
   * Send SMS to recipients
   * @param originator - Sender number/ID
   * @param recipients - Array of recipient phone numbers
   * @param message - SMS message content
   * @returns Promise with SMS response
   */
  send(
    originator: string,
    recipients: string[],
    message: string,
  ): Promise<SmsResponse>;

  /**
   * Check if adapter is properly configured
   */
  isConfigured(): boolean;
}

