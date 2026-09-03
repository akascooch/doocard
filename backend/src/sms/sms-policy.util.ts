import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_SMS_POLICY,
  SmsEventKey,
  SMS_EVENT_KEYS,
} from './sms-event-keys';

type PrismaLike = Pick<PrismaClient, 'smsNotificationRule'>;

/**
 * Pure policy check (no Nest DI) — safe to call from AppointmentsService without circular imports.
 */
export async function isSmsEventAllowed(
  prisma: PrismaLike,
  eventKey: string,
): Promise<boolean> {
  const known = Object.values(SMS_EVENT_KEYS).includes(eventKey as SmsEventKey);
  if (!known) return false;

  try {
    const row = await prisma.smsNotificationRule.findUnique({
      where: { eventKey },
    });
    if (row) return row.smsEnabled === true;
  } catch {
    // Table may not exist yet — fall through to defaults
  }

  const fallback = DEFAULT_SMS_POLICY.find((r) => r.eventKey === eventKey);
  return fallback?.smsEnabled === true;
}
