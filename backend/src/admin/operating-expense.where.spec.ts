import {
  isClearedOperatingCheque,
  isOperatingExpense,
  splitExpenseChart,
  type OperatingExpenseFixture,
} from './operating-expense.where';

const manualExpense: OperatingExpenseFixture = {
  type: 'EXPENSE',
  sourceType: 'MANUAL',
  categoryCode: 'RENT',
  chequeCategory: null,
};

const clearedOperatingCheque: OperatingExpenseFixture = {
  type: 'EXPENSE',
  sourceType: 'CHEQUE_LEAF',
  categoryCode: 'RENT',
  chequeCategory: 'NORMAL',
};

const payrollCheque: OperatingExpenseFixture = {
  type: 'EXPENSE',
  sourceType: 'CHEQUE_LEAF_PAYROLL',
  categoryCode: 'PAYROLL',
  chequeCategory: 'NORMAL',
};

const guaranteeCheque: OperatingExpenseFixture = {
  type: 'EXPENSE',
  sourceType: 'CHEQUE_LEAF',
  categoryCode: 'RENT',
  chequeCategory: 'GUARANTEE',
};

describe('operating expense chart inclusion', () => {
  it('includes a manual expense and a cleared operating cheque exactly once', () => {
    const rows = [manualExpense, clearedOperatingCheque, payrollCheque, guaranteeCheque];
    const operating = rows.filter(isOperatingExpense);
    const cheques = rows.filter(isClearedOperatingCheque);

    expect(operating).toEqual([manualExpense, clearedOperatingCheque]);
    expect(cheques).toEqual([clearedOperatingCheque]);
    expect(operating.filter((row) => row.sourceType === 'CHEQUE_LEAF')).toHaveLength(1);
  });

  it('keeps payroll and guarantee cheques out of the operating total', () => {
    expect(isOperatingExpense(payrollCheque)).toBe(false);
    expect(isOperatingExpense(guaranteeCheque)).toBe(false);
    expect(isClearedOperatingCheque(payrollCheque)).toBe(false);
    expect(isClearedOperatingCheque(guaranteeCheque)).toBe(false);
  });

  it('stacks the cheque amount inside the total instead of adding it again', () => {
    const manual = 1000n;
    const cheque = 400n;
    const split = splitExpenseChart(manual + cheque, cheque);
    expect(split.total).toBe(1400n);
    expect(split.cheques).toBe(400n);
    expect(split.other).toBe(1000n);
    expect(split.other + split.cheques).toBe(split.total);
  });
});
