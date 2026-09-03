/**
 * LOCAL smoke test — commission formulas vs business expectations.
 *
 * Usage (from Backend/):
 *   npx ts-node -r tsconfig-paths/register scripts/verify-salary-logic.ts
 *
 * Does not touch the database or production.
 *
 * Business expectations (تومان):
 *   Special:  (Amount − 200_000) × 0.50
 *   Standard: (Amount − 200_000) × 0.40
 *             ≡ (Amount × 0.40) − 80_000  (barber's 40% of the 200k tax)
 *
 * Runtime amounts in code are IRR (×10). This script converts for comparison.
 */
import {
  TOMAN_TO_RIAL,
  computeAppointmentCommissionShare,
} from '../src/common/constants/employee-commission.constants';
import { calculateEmployeeSalaryPreview } from '../src/admin/employee-salary.service';
import { AppointmentStatus, TransactionType } from '@prisma/client';

const AMOUNT_TOMAN = 3_000_000;
const AMOUNT_RIAL = BigInt(AMOUNT_TOMAN * TOMAN_TO_RIAL);

type Row = {
  case: string;
  amount: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL';
};

function tomanFromRial(rial: bigint): number {
  return Number(rial / BigInt(TOMAN_TO_RIAL));
}

function mockPrismaForBarber(opts: {
  employeeId: number;
  isSpecialCommission: boolean;
  amountRial: bigint;
}) {
  const scheduledAt = new Date('2024-06-15T06:30:00.000Z');
  return {
    employee: {
      findUnique: async () => ({
        id: opts.employeeId,
        commissionRate: 0,
        isSpecialCommission: opts.isSpecialCommission,
        lastCommissionSettlementAt: null,
        user: {
          name: opts.isSpecialCommission ? 'Special Barber' : 'Standard Barber',
          role: 'EMPLOYEE',
        },
      }),
    },
    employeeCommissionSettlement: { findFirst: async () => null },
    employeeCommissionSettlementAppointment: { findMany: async () => [] },
    employeeCommissionSettlementTransaction: { findMany: async () => [] },
    appointment: {
      findMany: async () => [
        {
          id: 1001,
          amount: opts.amountRial,
          scheduledAt,
          status: AppointmentStatus.SETTLED,
          customer: { user: { name: 'Smoke Customer' } },
        },
      ],
      count: async () => 0,
    },
    appointmentTipAllocation: { findMany: async () => [] },
    manualTipAllocation: { findMany: async () => [] },
    transactionCategory: { findMany: async () => [] },
    salary: { findMany: async () => [] },
    transaction: {
      findMany: async () =>
        [] as Array<{
          id: number;
          type: TransactionType;
          amount: bigint;
          occurredAt: Date;
          description: string | null;
          category: { name: string } | null;
          sourceType: string | null;
        }>,
    },
  } as any;
}

function printTable(rows: Row[]) {
  const cols = ['Case', 'Amount', 'Expected', 'Actual', 'Status'] as const;
  const data = rows.map((r) => [
    r.case,
    r.amount,
    r.expected,
    r.actual,
    r.status,
  ]);
  const widths = cols.map((c, i) =>
    Math.max(c.length, ...data.map((row) => String(row[i]).length)),
  );
  const line = (cells: string[]) =>
    '| ' + cells.map((c, i) => c.padEnd(widths[i])).join(' | ') + ' |';
  const sep =
    '|-' + widths.map((w) => '-'.repeat(w)).join('-|-') + '-|';
  console.log(line([...cols]));
  console.log(sep);
  for (const row of data) console.log(line(row.map(String)));
}

async function main() {
  const expectedSpecialToman = Math.trunc((AMOUNT_TOMAN - 200_000) * 0.5); // 1_400_000
  const expectedStandardToman = Math.trunc((AMOUNT_TOMAN - 200_000) * 0.4); // 1_120_000

  // Layer 1: pure helper used by payroll
  const specialHelper = computeAppointmentCommissionShare(AMOUNT_RIAL, true);
  const standardHelper = computeAppointmentCommissionShare(AMOUNT_RIAL, false);

  // Layer 2: full preview path (mock Prisma, no DB)
  const specialPreview = await calculateEmployeeSalaryPreview(
    mockPrismaForBarber({
      employeeId: 4,
      isSpecialCommission: true,
      amountRial: AMOUNT_RIAL,
    }),
    {
      employeeId: 4,
      fromJalali: '1403/03/15',
      toJalali: '1403/03/15',
    },
  );
  const standardPreview = await calculateEmployeeSalaryPreview(
    mockPrismaForBarber({
      employeeId: 1,
      isSpecialCommission: false,
      amountRial: AMOUNT_RIAL,
    }),
    {
      employeeId: 1,
      fromJalali: '1403/03/15',
      toJalali: '1403/03/15',
    },
  );

  const rows: Row[] = [
    {
      case: 'A Special helper',
      amount: String(AMOUNT_TOMAN),
      expected: String(expectedSpecialToman),
      actual: String(tomanFromRial(specialHelper.netShareRial)),
      status:
        tomanFromRial(specialHelper.netShareRial) === expectedSpecialToman
          ? 'PASS'
          : 'FAIL',
    },
    {
      case: 'A Special preview',
      amount: String(AMOUNT_TOMAN),
      expected: String(expectedSpecialToman),
      actual: String(tomanFromRial(BigInt(specialPreview.netPayable))),
      status:
        tomanFromRial(BigInt(specialPreview.netPayable)) ===
        expectedSpecialToman
          ? 'PASS'
          : 'FAIL',
    },
    {
      case: 'B Standard helper',
      amount: String(AMOUNT_TOMAN),
      expected: String(expectedStandardToman),
      actual: String(tomanFromRial(standardHelper.netShareRial)),
      status:
        tomanFromRial(standardHelper.netShareRial) === expectedStandardToman
          ? 'PASS'
          : 'FAIL',
    },
    {
      case: 'B Standard preview',
      amount: String(AMOUNT_TOMAN),
      expected: String(expectedStandardToman),
      actual: String(tomanFromRial(BigInt(standardPreview.netPayable))),
      status:
        tomanFromRial(BigInt(standardPreview.netPayable)) ===
        expectedStandardToman
          ? 'PASS'
          : 'FAIL',
    },
  ];

  // Extra audit: special must exclude tips; tip allocations ignored for EMPLOYEE
  const tipGuardPass =
    specialPreview.teamShareIncome === '0' &&
    specialPreview.tipAllocationCount === 0 &&
    specialPreview.totalTipIncome === '0' &&
    standardPreview.teamShareIncome === '0' &&
    standardPreview.tipAllocationCount === 0;

  rows.push({
    case: 'Tips excluded (both)',
    amount: String(AMOUNT_TOMAN),
    expected: '0 tip income',
    actual: tipGuardPass ? '0 tip income' : 'tips leaked',
    status: tipGuardPass ? 'PASS' : 'FAIL',
  });

  console.log('Salary commission smoke test (amounts in تومان)');
  console.log(
    `Input AppointmentAmount=${AMOUNT_TOMAN} تومان (= ${AMOUNT_RIAL} IRR)`,
  );
  console.log(
    `Special taxApplied=${tomanFromRial(specialHelper.taxAppliedRial)} | Standard taxApplied=${tomanFromRial(standardHelper.taxAppliedRial)}`,
  );
  console.log(
    `Special per-appointment: taxApplied=${specialPreview.appointments[0]?.taxApplied} IRR, netShare=${specialPreview.appointments[0]?.netShare} IRR`,
  );
  console.log(
    `Standard per-appointment: taxApplied=${standardPreview.appointments[0]?.taxApplied} IRR, netShare=${standardPreview.appointments[0]?.netShare} IRR`,
  );
  console.log('');
  printTable(rows);

  const failed = rows.filter((r) => r.status === 'FAIL');
  if (failed.length > 0) {
    console.error('\nSTOP: calculation mismatch — do not promote to production.');
    console.error(
      JSON.stringify(
        {
          failed,
          note:
            'Standard policy in code is (amount×40%)−80k تومان, which equals (amount−200k)×40% algebraically.',
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  console.log('\nAll smoke cases PASS.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
