import { DEFAULT_SMS_POLICY, SMS_EVENT_KEYS } from './sms-event-keys';
import {
  DEFAULT_SMS_TEMPLATES,
  SMS_TEMPLATE_KEYS,
} from './sms-template.catalog';

describe('SMS catalog — settlement + tip', () => {
  it('registers appointment.settled policy as enabled by default', () => {
    const rule = DEFAULT_SMS_POLICY.find(
      (r) => r.eventKey === SMS_EVENT_KEYS.APPOINTMENT_SETTLED,
    );
    expect(rule).toEqual(
      expect.objectContaining({
        eventKey: 'appointment.settled',
        smsEnabled: true,
      }),
    );
  });

  it('registers appointment_settled_barber with gross/net variables', () => {
    const tpl = DEFAULT_SMS_TEMPLATES.find(
      (t) => t.name === SMS_TEMPLATE_KEYS.APPOINTMENT_SETTLED_BARBER,
    );
    expect(tpl).toBeDefined();
    expect(tpl?.variables).toEqual(
      expect.arrayContaining([
        'barberName',
        'customerName',
        'grossAmount',
        'netAmount',
        'appointmentId',
        'date',
      ]),
    );
    expect(tpl?.content).toContain('سهم تسویه: {netAmount} تومان');
    expect(tpl?.content).toContain('مبلغ کل: {grossAmount} تومان');
  });

  it('keeps tip_received template for SERVICE staff alerts', () => {
    const tpl = DEFAULT_SMS_TEMPLATES.find(
      (t) => t.name === SMS_TEMPLATE_KEYS.TIP_RECEIVED,
    );
    expect(tpl?.variables).toEqual(
      expect.arrayContaining(['amount', 'customerName', 'barberName', 'source']),
    );
  });
});
