import fs from 'fs';
import path from 'path';
import {
  DEFAULT_APPOINTMENT_PAYMENT_METHOD,
  UNSET_PAYMENT_METHOD_LABEL,
  appointmentPaymentFilterParams,
  formatAppointmentPaymentMethod,
} from '../payment-method';
import { DEFAULT_APPOINTMENT_SETTLE_PAYMENT_METHOD } from '../offline/types';

describe('appointment payment method labels and filters', () => {
  it('renders CARD with the settlement form label and keeps null distinct', () => {
    expect(formatAppointmentPaymentMethod('CARD')).toBe('کارت خوان');
    expect(formatAppointmentPaymentMethod('CASH')).toBe('نقدی');
    expect(formatAppointmentPaymentMethod(null)).toBe(UNSET_PAYMENT_METHOD_LABEL);
    expect(formatAppointmentPaymentMethod(undefined)).toBe(UNSET_PAYMENT_METHOD_LABEL);
    expect(formatAppointmentPaymentMethod('LEGACY')).toBe('LEGACY');
  });

  it('sends enum filters to the server and uses a boolean for null rows', () => {
    expect(appointmentPaymentFilterParams('ALL')).toEqual({});
    expect(appointmentPaymentFilterParams('CARD')).toEqual({ paymentMethod: 'CARD' });
    expect(appointmentPaymentFilterParams('UNSET')).toEqual({ paymentMethodUnset: 'true' });
  });

  it('defaults new appointment settlement to CARD in the UI, reset, and offline payload', () => {
    expect(DEFAULT_APPOINTMENT_PAYMENT_METHOD).toBe('CARD');
    expect(DEFAULT_APPOINTMENT_SETTLE_PAYMENT_METHOD).toBe('CARD');

    const modal = fs.readFileSync(
      path.join(__dirname, '../../components/appointments/PaymentModal.tsx'),
      'utf8',
    );
    expect(modal).toContain("paymentMethod: 'CARD'");
    expect(modal).toContain('paymentMethod: formData.paymentMethod');
    expect(modal).not.toContain("paymentMethod: 'CASH'");

    const sync = fs.readFileSync(
      path.join(__dirname, '../offline/sync-worker.ts'),
      'utf8',
    );
    expect(sync).toContain('payload.paymentMethod ?? DEFAULT_APPOINTMENT_SETTLE_PAYMENT_METHOD');
    expect(sync).not.toContain("paymentMethod: 'CASH'");
  });

  it('leaves payroll and accounting cash defaults unchanged', () => {
    const salary = fs.readFileSync(
      path.join(__dirname, '../../../../backend/src/accounting/salary.service.ts'),
      'utf8',
    );
    const accounting = fs.readFileSync(
      path.join(__dirname, '../../app/dashboard/admin/accounting/page.tsx'),
      'utf8',
    );
    expect(salary).toContain("paymentMethod: 'CASH'");
    expect(accounting).toContain("paymentMethod: 'CASH'");
  });
});
