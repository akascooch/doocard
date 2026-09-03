/**
 * Production-safe bulk commission/tip settlement up to a Jalali cutoff.
 *
 * Reuses EmployeeSalaryService.preview + commitSettlement (same logic as admin UI).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/payroll-settle-until.ts --cutoff-jalali=1405/04/19 --dry-run
 *   npx ts-node -r tsconfig-paths/register scripts/payroll-settle-until.ts --cutoff-jalali=1405/04/19 --apply --idempotency-key=bulk-settle-until-1405-04-19
 *
 * Optional:
 *   --bank-account-id=N
 *   --admin-user-id=N
 *   --employee-id=N   (limit to one employee)
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as jalaali from 'jalaali-js';
import { PrismaClient } from '@prisma/client';
import { EmployeeSalaryService } from '../src/admin/employee-salary.service';
import { PrismaService } from '../src/prisma/prisma.service';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;
/** Fallback only when an employee has no ACTIVE settlement yet. */
const DEFAULT_FROM_JALALI = '1405/04/13';
const CUTOFF_JALALI_DEFAULT = '1405/04/19';
const EXPECTED_CUTOFF_UTC_ISO = '2026-07-10T20:29:59.999Z';

type Args = {
  dryRun: boolean;
  apply: boolean;
  cutoffJalali: string;
  cutoffUtc?: string;
  defaultFromJalali: string;
  idempotencyKey: string;
  bankAccountId?: number;
  adminUserId?: number;
  employeeId?: number;
};

function parseArgs(argv: string[]): Args {
  const get = (name: string) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  const apply = argv.includes('--apply');
  return {
    dryRun: !apply || argv.includes('--dry-run'),
    apply,
    cutoffJalali: get('cutoff-jalali') || CUTOFF_JALALI_DEFAULT,
    cutoffUtc: get('cutoff'),
    defaultFromJalali: get('default-from-jalali') || DEFAULT_FROM_JALALI,
    idempotencyKey: get('idempotency-key') || 'bulk-settle-until-1405-04-19',
    bankAccountId: get('bank-account-id')
      ? parseInt(get('bank-account-id')!, 10)
      : undefined,
    adminUserId: get('admin-user-id')
      ? parseInt(get('admin-user-id')!, 10)
      : undefined,
    employeeId: get('employee-id') ? parseInt(get('employee-id')!, 10) : undefined,
  };
}

function normalizeDigits(input: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const english = '0123456789';
  return (input || '').replace(/[۰-۹]/g, (d) => english[persian.indexOf(d)] ?? d);
}

function jalaliDayEndUtc(jalaliStr: string): Date | null {
  const normalized = normalizeDigits(jalaliStr).trim().replace(/-/g, '/');
  const parts = normalized.split('/').map(Number);
  if (parts.length !== 3) return null;
  const [jy, jm, jd] = parts;
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) return null;
  const g = jalaali.toGregorian(jy, jm, jd);
  return new Date(
    Date.UTC(g.gy, g.gm - 1, g.gd, 23, 59, 59, 999) - TEHRAN_OFFSET_MS,
  );
}

function formatMoney(rial: bigint | string | number): string {
  const n = BigInt(rial);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function notesMarker(idempotencyKey: string, cutoffJalali: string): string {
  return `BULK_SETTLE|idempotency=${idempotencyKey}|cutoff=${normalizeDigits(cutoffJalali)}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cutoffJalali = normalizeDigits(args.cutoffJalali);
  const cutoffEnd = jalaliDayEndUtc(cutoffJalali);
  if (!cutoffEnd) {
    console.error('Invalid --cutoff-jalali. Expected YYYY/MM/DD');
    process.exit(1);
  }

  console.log('=== payroll-settle-until ===');
  console.log(`MODE=${args.apply ? 'APPLY' : 'DRY_RUN'}`);
  console.log(`CUTOFF_JALALI=${cutoffJalali}`);
  console.log(`CUTOFF_UTC=${cutoffEnd.toISOString()}`);
  console.log(`EXPECTED_UTC=${EXPECTED_CUTOFF_UTC_ISO}`);
  console.log(
    `CUTOFF_MATCHES_EXPECTED=${cutoffEnd.toISOString() === EXPECTED_CUTOFF_UTC_ISO}`,
  );
  if (args.cutoffUtc && args.cutoffUtc !== cutoffEnd.toISOString()) {
    console.warn(
      `WARN: --cutoff=${args.cutoffUtc} differs from Jalali-derived ${cutoffEnd.toISOString()}; using Jalali-derived value`,
    );
  }
  console.log(`IDEMPOTENCY_KEY=${args.idempotencyKey}`);
  console.log(`DEFAULT_FROM_JALALI=${normalizeDigits(args.defaultFromJalali)}`);

  const prisma = new PrismaClient();
  const prismaService = prisma as unknown as PrismaService;
  const salaryService = new EmployeeSalaryService(prismaService);

  try {
    let adminUserId = args.adminUserId;
    if (!adminUserId) {
      const admin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        orderBy: { id: 'asc' },
        select: { id: true, name: true },
      });
      if (!admin) throw new Error('No ADMIN user found');
      adminUserId = admin.id;
      console.log(`ADMIN_USER_ID=${adminUserId} (${admin.name})`);
    }

    let bankAccountId = args.bankAccountId;
    if (!bankAccountId) {
      const account = await prisma.bankAccount.findFirst({
        where: { deletedAt: null },
        orderBy: { id: 'asc' },
        select: { id: true, name: true, balance: true },
      });
      if (!account) throw new Error('No bank account found');
      bankAccountId = account.id;
      console.log(
        `BANK_ACCOUNT_ID=${bankAccountId} (${account.name}) balance=${account.balance.toString()}`,
      );
    }

    const defaultFrom = normalizeDigits(args.defaultFromJalali);

    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
        ...(args.employeeId ? { id: args.employeeId } : {}),
        user: { role: { in: ['EMPLOYEE', 'SERVICE'] } },
      },
      include: {
        user: { select: { id: true, name: true, phone: true, role: true } },
      },
      orderBy: { id: 'asc' },
    });

    console.log(`EMPLOYEE_COUNT=${employees.length}`);
    console.log('---');

    const marker = notesMarker(args.idempotencyKey, cutoffJalali);
    const rows: Array<{
      employeeId: number;
      name: string;
      phone: string | null;
      role: string;
      fromJalali: string;
      toJalali: string;
      netPayable: string;
      priorWithdrawalsTotal: string;
      appointments: number;
      tips: number;
      action: string;
      settlementId?: number;
      error?: string;
    }> = [];

    let totalNet = 0n;
    let settleCount = 0;
    let skipZero = 0;
    let skipIdempotent = 0;
    let skipNegative = 0;
    let errorCount = 0;

    for (const emp of employees) {
      const lastActive = await prisma.employeeCommissionSettlement.findFirst({
        where: { employeeId: emp.id, status: 'ACTIVE' },
        orderBy: { periodEndAt: 'desc' },
      });

      // Already settled through/after this cutoff via this bulk key?
      const existingBulk = await prisma.employeeCommissionSettlement.findFirst({
        where: {
          employeeId: emp.id,
          status: 'ACTIVE',
          notes: { contains: `idempotency=${args.idempotencyKey}` },
          periodEndJalali: cutoffJalali,
        },
      });

      if (existingBulk) {
        skipIdempotent += 1;
        rows.push({
          employeeId: emp.id,
          name: emp.user.name,
          phone: emp.user.phone,
          role: emp.user.role,
          fromJalali: existingBulk.periodStartJalali || '',
          toJalali: cutoffJalali,
          netPayable: '0',
          priorWithdrawalsTotal: '0',
          appointments: 0,
          tips: 0,
          action: 'SKIP_IDEMPOTENT',
          settlementId: existingBulk.id,
        });
        continue;
      }

      // Continuity rule: from must equal last ACTIVE periodEndJalali when present.
      const fromJalali = lastActive?.periodEndJalali || defaultFrom;

      if (
        lastActive?.periodEndAt &&
        lastActive.periodEndAt.getTime() > cutoffEnd.getTime()
      ) {
        skipZero += 1;
        rows.push({
          employeeId: emp.id,
          name: emp.user.name,
          phone: emp.user.phone,
          role: emp.user.role,
          fromJalali,
          toJalali: cutoffJalali,
          netPayable: '0',
          priorWithdrawalsTotal: '0',
          appointments: 0,
          tips: 0,
          action: 'SKIP_ALREADY_PAST_CUTOFF',
          settlementId: lastActive.id,
        });
        continue;
      }

      try {
        const preview = await salaryService.preview({
          employeeId: emp.id,
          fromJalali,
          toJalali: cutoffJalali,
        });
        // Admin bulk settle uses settlementPayable (= netPayable for barbers; tip-basis for SERVICE).
        const net = BigInt(preview.settlementPayable ?? preview.netPayable);
        totalNet += net;

        if (net < 0n) {
          skipNegative += 1;
          rows.push({
            employeeId: emp.id,
            name: emp.user.name,
            phone: emp.user.phone,
            role: emp.user.role,
            fromJalali,
            toJalali: cutoffJalali,
            netPayable: net.toString(),
            priorWithdrawalsTotal: preview.priorWithdrawalsTotal,
            appointments: preview.totalAppointments,
            tips: preview.tipAllocationCount,
            action: 'SKIP_NEGATIVE',
          });
          continue;
        }

        if (net === 0n) {
          skipZero += 1;
          rows.push({
            employeeId: emp.id,
            name: emp.user.name,
            phone: emp.user.phone,
            role: emp.user.role,
            fromJalali,
            toJalali: cutoffJalali,
            netPayable: '0',
            priorWithdrawalsTotal: preview.priorWithdrawalsTotal,
            appointments: preview.totalAppointments,
            tips: preview.tipAllocationCount,
            action: 'SKIP_ZERO',
          });
          continue;
        }

        if (!args.apply) {
          settleCount += 1;
          rows.push({
            employeeId: emp.id,
            name: emp.user.name,
            phone: emp.user.phone,
            role: emp.user.role,
            fromJalali,
            toJalali: cutoffJalali,
            netPayable: net.toString(),
            priorWithdrawalsTotal: preview.priorWithdrawalsTotal,
            appointments: preview.totalAppointments,
            tips: preview.tipAllocationCount,
            action: 'WOULD_SETTLE',
          });
          continue;
        }

        const result = await salaryService.commitSettlement(
          {
            employeeId: emp.id,
            fromJalali,
            toJalali: cutoffJalali,
            commissionPercentage: preview.commissionPercentageUsed,
            periodStartConfirmed: true,
            bankAccountId,
            notes: marker,
          },
          adminUserId,
        );

        settleCount += 1;
        rows.push({
          employeeId: emp.id,
          name: emp.user.name,
          phone: emp.user.phone,
          role: emp.user.role,
          fromJalali,
          toJalali: cutoffJalali,
          netPayable: result.settlementPayable ?? result.netPayable,
          priorWithdrawalsTotal: preview.priorWithdrawalsTotal,
          appointments: result.appointmentCount,
          tips: preview.tipAllocationCount,
          action: 'SETTLED',
          settlementId: result.settlementId,
        });
      } catch (err: any) {
        errorCount += 1;
        rows.push({
          employeeId: emp.id,
          name: emp.user.name,
          phone: emp.user.phone,
          role: emp.user.role,
          fromJalali,
          toJalali: cutoffJalali,
          netPayable: '?',
          priorWithdrawalsTotal: '?',
          appointments: 0,
          tips: 0,
          action: 'ERROR',
          error: err?.message || String(err),
        });
      }
    }

    console.log('');
    console.log('=== PER EMPLOYEE ===');
    for (const r of rows) {
      console.log(
        [
          `id=${r.employeeId}`,
          `name=${r.name}`,
          `role=${r.role}`,
          `from=${r.fromJalali}`,
          `to=${r.toJalali}`,
          `net=${formatMoney(r.netPayable === '?' ? 0 : r.netPayable)}`,
          `prior=${r.priorWithdrawalsTotal}`,
          `appts=${r.appointments}`,
          `tips=${r.tips}`,
          `action=${r.action}`,
          r.settlementId ? `settlementId=${r.settlementId}` : '',
          r.error ? `error=${r.error}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
      );
    }

    const wouldSettleTotal = rows
      .filter((r) => r.action === 'WOULD_SETTLE' || r.action === 'SETTLED')
      .reduce((acc, r) => acc + BigInt(r.netPayable), 0n);

    console.log('');
    console.log('=== SUMMARY ===');
    console.log(`EMPLOYEE_COUNT=${employees.length}`);
    console.log(`TOTAL_NET_SCANNED=${formatMoney(totalNet)}`);
    console.log(`TOTAL_NET_TO_SETTLE=${formatMoney(wouldSettleTotal)}`);
    console.log(`SETTLE_OR_WOULD_SETTLE_COUNT=${settleCount}`);
    console.log(`SKIP_ZERO=${skipZero}`);
    console.log(`SKIP_NEGATIVE=${skipNegative}`);
    console.log(`SKIP_IDEMPOTENT=${skipIdempotent}`);
    console.log(`ERRORS=${errorCount}`);
    console.log(`MODE=${args.apply ? 'APPLY' : 'DRY_RUN'}`);

    if (args.apply && errorCount > 0) {
      process.exitCode = 2;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
