import {
  appointmentPaymentBadgeClass,
  appointmentStatusBadgeClass,
} from '../appointment-status';

describe('appointment status and debt badges', () => {
  it('uses a green wash for settled and paid', () => {
    for (const status of ['SETTLED', 'PAID']) {
      expect(appointmentStatusBadgeClass(status)).toContain('text-emerald-800');
      expect(appointmentStatusBadgeClass(status)).toContain('dark:text-emerald-300');
    }
  });

  it('uses an amber wash for open appointment states', () => {
    for (const status of [
      'PENDING',
      'PENDING_CONFIRMATION',
      'CONFIRMED',
      'IN_PROGRESS',
      'COMPLETED',
    ]) {
      expect(appointmentStatusBadgeClass(status)).toContain('text-amber-900');
      expect(appointmentStatusBadgeClass(status)).toContain('dark:text-amber-300');
    }
  });

  it('uses a rose wash for cancelled appointments and debt settlement', () => {
    expect(appointmentStatusBadgeClass('CANCELLED')).toContain('text-rose-800');
    expect(appointmentPaymentBadgeClass('DEBT')).toContain('text-rose-800');
    expect(appointmentPaymentBadgeClass('DEBT')).toContain('dark:text-rose-300');
  });

  it('keeps cash and unknown methods off the debt alert', () => {
    expect(appointmentPaymentBadgeClass('CASH')).not.toContain('rose');
    expect(appointmentPaymentBadgeClass('CARD')).not.toContain('rose');
    expect(appointmentPaymentBadgeClass(null)).not.toContain('rose');
  });
});
