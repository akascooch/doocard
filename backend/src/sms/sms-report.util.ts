/**
 * Derive safe report fields from existing sms_events without leaking secrets.
 */
export function deriveRecipientType(dedupeKey?: string | null): string {
  const k = dedupeKey || '';
  if (k.includes(':employee:') || k.includes(':barber:')) return 'BARBER';
  if (k.startsWith('customer.admin:')) return 'ADMIN';
  if (k.startsWith('customer.welcome:')) return 'CUSTOMER';
  if (k.includes(':customer:')) return 'CUSTOMER';
  if (k.startsWith('custom:') || k.startsWith('sms.test:') || k.startsWith('admin.'))
    return 'CUSTOM';
  if (k.startsWith('notification.created:')) return 'CUSTOM';
  return 'UNKNOWN';
}

export function deriveEntityIds(dedupeKey?: string | null): {
  customerUserId?: number;
  barberHint?: string;
  adminId?: number;
  appointmentIdFromKey?: number;
} {
  const k = dedupeKey || '';
  const welcome = k.match(/^customer\.welcome:(\d+)$/);
  if (welcome) return { customerUserId: Number(welcome[1]) };
  const admin = k.match(/^customer\.admin:(\d+):(\d+)$/);
  if (admin) return { customerUserId: Number(admin[1]), adminId: Number(admin[2]) };
  const appt = k.match(/:(\d+)$/);
  if (k.includes('appointment.') && appt) {
    return { appointmentIdFromKey: Number(appt[1]) };
  }
  return {};
}

/**
 * Prefer stored templateKey; for legacy rows, infer from dedupeKey/eventKey.
 */
export function deriveTemplateKey(params: {
  templateKey?: string | null;
  dedupeKey?: string | null;
  eventKey?: string | null;
}): string | null {
  if (params.templateKey) return params.templateKey;
  const k = params.dedupeKey || '';
  if (k.startsWith('customer.welcome:')) return 'welcome_customer';
  if (k.startsWith('customer.admin:')) return 'admin_new_customer';
  if (k.includes('appointment.created:customer:'))
    return 'appointment_created_customer';
  if (k.includes('appointment.created:employee:'))
    return 'appointment_created_barber';
  if (k.includes('appointment.confirmed:customer:'))
    return 'appointment_confirmed_customer';
  if (k.includes('appointment.cancelled:customer:'))
    return 'appointment_cancelled_customer';
  if (k.startsWith('sms.test:') || params.eventKey === 'admin.test')
    return 'sms_test';
  if (k.startsWith('custom:') || params.eventKey === 'admin.custom')
    return 'sms_custom';
  if (params.eventKey === 'notification.created') return 'ad_hoc_notification';
  return null;
}

export function summarizeProviderResp(providerResp?: string | null): {
  error?: string;
  note?: string;
} {
  if (!providerResp) return {};
  try {
    const parsed = JSON.parse(providerResp);
    const err = parsed?.error || parsed?.message;
    if (typeof err === 'string') return { error: err.slice(0, 200) };
    return { note: 'provider_ok' };
  } catch {
    return { error: String(providerResp).slice(0, 200) };
  }
}
