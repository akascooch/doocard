/**
 * Hard-required admin CC recipients for every outbound SMS.
 * Applied centrally in SmsOutboundService (not per caller).
 */
export const SMS_ALWAYS_CC_PHONES = ['09121013686', '09370504588'] as const;
