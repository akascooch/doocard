import { buildSalaryBreakdownFromPreview } from './salary-breakdown.dto';

describe('buildSalaryBreakdownFromPreview (barber tips removed)', () => {
  it('BARBER: finalAmount is appointment-only; team tip 0; no admin tip total', () => {
    const breakdown = buildSalaryBreakdownFromPreview({
      isServiceStaff: false,
      totalAppointments: 4,
      totalRevenue: '121000000',
      platformShare: '72600000',
      employeeShare: '48400000',
      totalDeduction: '3200000',
      priorWithdrawalsTotal: '0',
      netPayable: '45200000',
      teamShareIncome: '0',
      settlementPayable: '45200000',
      commissionPercentageUsed: 40,
      tipAllocationCount: 0,
    });

    expect(breakdown.finalAmount).toBe('45200000');
    expect(breakdown.teamTipAmount).toBe('0');
    expect(breakdown.settlementPayable).toBe('45200000');

    const finalItem = breakdown.breakdownItems.find((i) => i.key === 'final');
    expect(finalItem?.label).toContain('سهم نوبت');
    expect(finalItem?.description).not.toMatch(/سهم تیمی/);

    expect(
      breakdown.breakdownItems.find((i) => i.key === 'admin_settlement'),
    ).toBeUndefined();
  });

  it('legacy snapshot without settlementPayable does not invent double-counted total', () => {
    const breakdown = buildSalaryBreakdownFromPreview({
      isServiceStaff: false,
      totalRevenue: '10000000',
      platformShare: '6000000',
      employeeShare: '4000000',
      totalDeduction: '800000',
      priorWithdrawalsTotal: '0',
      netPayable: '3700000',
      teamShareIncome: '500000',
      commissionPercentageUsed: 40,
      totalAppointments: 1,
    });

    expect(breakdown.finalAmount).toBe('3700000');
    expect(breakdown.settlementPayable).toBeUndefined();
    expect(
      breakdown.breakdownItems.find((i) => i.key === 'admin_settlement'),
    ).toBeUndefined();
  });

  it('SERVICE: finalAmount equals tip net; no admin_settlement tip double-count', () => {
    const breakdown = buildSalaryBreakdownFromPreview({
      isServiceStaff: true,
      totalTipIncome: '750000',
      employeeShare: '750000',
      priorWithdrawalsTotal: '0',
      netPayable: '750000',
      tipAllocationCount: 2,
    });

    expect(breakdown.finalAmount).toBe('750000');
    expect(breakdown.teamTipAmount).toBe('0');
    expect(
      breakdown.breakdownItems.find((i) => i.key === 'admin_settlement'),
    ).toBeUndefined();
  });

  it('negative netPayable is labeled as payable debt (not clamped)', () => {
    const breakdown = buildSalaryBreakdownFromPreview({
      isServiceStaff: false,
      totalRevenue: '1000000',
      platformShare: '500000',
      employeeShare: '-500000',
      totalDeduction: '2000000',
      priorWithdrawalsTotal: '0',
      netPayable: '-500000',
      settlementPayable: '-500000',
      commissionPercentageUsed: 50,
      totalAppointments: 1,
      teamShareIncome: '0',
    });

    expect(breakdown.finalAmount).toBe('-500000');
    const finalItem = breakdown.breakdownItems.find((i) => i.key === 'final');
    expect(finalItem?.label).toContain('بدهی');
  });
});
