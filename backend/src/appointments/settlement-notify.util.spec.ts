import {
  formatBarberSettlementMessage,
  formatFaAmount,
  resolveSettlementToman,
  rialToToman,
  settlementBarberNotifyKeys,
} from './settlement-notify.util';

describe('settlement-notify.util', () => {
  it('converts rial to toman', () => {
    expect(rialToToman(800_000)).toBe(80_000);
    expect(rialToToman(1_250_000n)).toBe(125_000);
    expect(rialToToman(null)).toBe(0);
  });

  it('resolves gross and net from appointment snapshot', () => {
    const { grossToman, netToman } = resolveSettlementToman({
      barberPayoutGrossAmount: 5_000_000,
      barberPayoutNetAmount: 4_200_000,
    });
    expect(grossToman).toBe(500_000);
    expect(netToman).toBe(420_000);
    expect(formatFaAmount(netToman)).toMatch(/۴۲۰/);
  });

  it('builds idempotent relatedEntity and SMS dedupeKey', () => {
    expect(settlementBarberNotifyKeys(42, 7)).toEqual({
      relatedEntity: 'appointment.settled:42:emp:7',
      dedupeKey: 'appointment.settled:42:emp:7:sms',
    });
  });

  it('formats barber settlement copy with net toman only', () => {
    const message = formatBarberSettlementMessage(42, 420_000);
    expect(message).toContain('سهم خالص');
    expect(message).toContain('۴۲۰');
    expect(message).toMatch(/نوبت 42/);
  });

  it('falls back to checkout amount for gross when snapshot is missing', () => {
    const { grossToman, netToman } = resolveSettlementToman(
      { amount: 5_000_000 },
      5_000_000,
    );
    expect(grossToman).toBe(500_000);
    expect(netToman).toBe(500_000);
  });
});
