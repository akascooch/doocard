import { DEFAULT_SMS_POLICY, SMS_EVENT_KEYS } from './sms-event-keys';
import {
  DEFAULT_SMS_TEMPLATES,
  SMS_TEMPLATE_KEYS,
} from './sms-template.catalog';

describe('SMS catalog — settlement + tip', () => {
  it('registers appointment.settled policy as disabled by default', () => {
    const rule = DEFAULT_SMS_POLICY.find(
      (r) => r.eventKey === SMS_EVENT_KEYS.APPOINTMENT_SETTLED,
    );
    expect(rule).toEqual(
      expect.objectContaining({
        eventKey: 'appointment.settled',
        smsEnabled: false,
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

  it('disables tip.received SMS by default', () => {
    const rule = DEFAULT_SMS_POLICY.find(
      (r) => r.eventKey === SMS_EVENT_KEYS.TIP_RECEIVED,
    );
    expect(rule?.smsEnabled).toBe(false);
  });

  it('registers cheque due template with bank variables', () => {
    const tpl = DEFAULT_SMS_TEMPLATES.find(
      (t) => t.name === SMS_TEMPLATE_KEYS.CHEQUE_DUE_REMINDER,
    );
    expect(tpl?.variables).toEqual(
      expect.arrayContaining(['bankName', 'branch', 'chequeBookSerial', 'jalaliDueDate', 'stageLabel']),
    );
    expect(tpl?.content).toContain('{stageLabel}');
    expect(tpl?.content).toContain('{branch}');
    expect(tpl?.content).toContain('{chequeBookSerial}');
    expect(tpl?.content).toContain('{jalaliDueDate}');
  });

  it('registers back-in-stock waitlist template and policy', () => {
    const tpl = DEFAULT_SMS_TEMPLATES.find(
      (t) => t.name === SMS_TEMPLATE_KEYS.PRODUCT_BACK_IN_STOCK,
    );
    expect(tpl?.content).toContain('{productName}');
    const rule = DEFAULT_SMS_POLICY.find(
      (r) => r.eventKey === SMS_EVENT_KEYS.PRODUCT_BACK_IN_STOCK,
    );
    expect(rule).toEqual(
      expect.objectContaining({
        eventKey: 'shop.productBackInStock',
        smsEnabled: true,
      }),
    );
  });
});
