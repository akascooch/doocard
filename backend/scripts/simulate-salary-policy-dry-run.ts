/**
 * READ-ONLY production/local simulation: Old salary vs New special-commission policy.
 * Does NOT mutate DB. Does NOT require isSpecialCommission column.
 *
 * Usage (from Backend/):
 *   npx ts-node -r tsconfig-paths/register scripts/simulate-salary-policy-dry-run.ts
 *   npx ts-node -r tsconfig-paths/register scripts/simulate-salary-policy-dry-run.ts --out=/tmp/salary-policy-dry-run.json
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  TOMAN_TO_RIAL,
  computeAppointmentCommissionShare,
} from '../src/common/constants/employee-commission.constants';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SPECIAL_NAMES = ['آرش بهمن', 'اشکان اشتیش'] as const;
const TAX_SPECIAL_TOMAN = 200_000;
const TAX_DEFAULT_TOMAN = 80_000;
const SETTLED = ['SETTLED', 'PAID', 'COMPLETED'] as const;

function oldBarberShareRial(amountRial: bigint): {
  taxAppliedRial: bigint;
  netShareRial: bigint;
} {
  // Pre-policy formula used for all EMPLOYEE barbers: (amount × 40%) − 80k تومان
  const taxAppliedRial = BigInt(TAX_DEFAULT_TOMAN * TOMAN_TO_RIAL);
  const gross = (amountRial * 40n * 100n) / 10000n;
  return { taxAppliedRial, netShareRial: gross - taxAppliedRial };
}

function toman(rial: bigint): string {
  return (rial / BigInt(TOMAN_TO_RIAL)).toString();
}

function parseOutPath(argv: string[]): string {
  const hit = argv.find((a) => a.startsWith('--out='));
  return hit
    ? hit.slice('--out='.length)
    : path.join('/tmp', `salary-policy-dry-run-${Date.now()}.json`);
}

async function main() {
  const outPath = parseOutPath(process.argv.slice(2));
  const prisma = new PrismaClient();
  const failures: string[] = [];

  try {
    const specials = await prisma.employee.findMany({
      where: { user: { name: { in: [...SPECIAL_NAMES] }, role: 'EMPLOYEE' } },
      select: {
        id: true,
        user: { select: { name: true, role: true } },
      },
      orderBy: { id: 'asc' },
    });

    const normals = await prisma.employee.findMany({
      where: {
        isActive: true,
        user: {
          role: 'EMPLOYEE',
          name: { notIn: [...SPECIAL_NAMES] },
        },
      },
      select: {
        id: true,
        user: { select: { name: true, role: true } },
      },
      orderBy: { id: 'asc' },
      take: 2,
    });

    const services = await prisma.employee.findMany({
      where: { isActive: true, user: { role: 'SERVICE' } },
      select: {
        id: true,
        user: { select: { name: true, role: true } },
      },
      orderBy: { id: 'asc' },
      take: 2,
    });

    if (specials.length < 2) {
      failures.push(
        `Expected 2 special barbers by name; found ${specials.length}: ${specials
          .map((s) => s.user.name)
          .join(', ')}`,
      );
    }
    if (normals.length < 2) {
      failures.push(`Expected 2 normal barbers; found ${normals.length}`);
    }
    if (services.length < 2) {
      failures.push(`Expected 2 SERVICE staff; found ${services.length}`);
    }

    const barberCases: any[] = [];

    for (const emp of [...specials, ...normals]) {
      const isSpecial = SPECIAL_NAMES.includes(emp.user.name as any);
      const appointments = await prisma.appointment.findMany({
        where: {
          employeeId: emp.id,
          deletedAt: null,
          amount: { not: null },
          status: { in: [...SETTLED] },
        },
        select: {
          id: true,
          amount: true,
          scheduledAt: true,
          status: true,
          paidAt: true,
        },
        orderBy: { scheduledAt: 'desc' },
        take: 5,
      });

      const lines = appointments.map((a) => {
        const amount = a.amount ?? 0n;
        const oldCalc = oldBarberShareRial(amount);
        const newCalc = computeAppointmentCommissionShare(amount, isSpecial);
        const expectedTaxToman = isSpecial ? TAX_SPECIAL_TOMAN : TAX_DEFAULT_TOMAN;
        const expectedSplit = isSpecial ? 50 : 40;
        const taxOk =
          Number(newCalc.taxAppliedRial / BigInt(TOMAN_TO_RIAL)) ===
          expectedTaxToman;
        const splitOk = newCalc.splitPercentUsed === expectedSplit;
        if (!taxOk) {
          failures.push(
            `${emp.user.name} apt#${a.id}: taxApplied ${toman(
              newCalc.taxAppliedRial,
            )} تومان != ${expectedTaxToman}`,
          );
        }
        if (!splitOk) {
          failures.push(
            `${emp.user.name} apt#${a.id}: split ${newCalc.splitPercentUsed}% != ${expectedSplit}%`,
          );
        }
        return {
          appointmentId: a.id,
          scheduledAt: a.scheduledAt.toISOString(),
          amountToman: toman(amount),
          old: {
            taxToman: toman(oldCalc.taxAppliedRial),
            netShareToman: toman(oldCalc.netShareRial),
          },
          new: {
            taxToman: toman(newCalc.taxAppliedRial),
            netShareToman: toman(newCalc.netShareRial),
            splitPercent: newCalc.splitPercentUsed,
          },
          deltaNetShareToman: toman(
            newCalc.netShareRial - oldCalc.netShareRial,
          ),
          checks: { taxOk, splitOk },
        };
      });

      if (appointments.length === 0) {
        failures.push(
          `${emp.user.name} (employeeId=${emp.id}): no settled appointments in last-5 window`,
        );
      }

      barberCases.push({
        employeeId: emp.id,
        name: emp.user.name,
        role: emp.user.role,
        policy: isSpecial ? 'SPECIAL' : 'DEFAULT',
        appointmentCount: appointments.length,
        lines,
      });
    }

    const serviceCases: any[] = [];
    for (const emp of services) {
      const tips = await prisma.appointmentTipAllocation.findMany({
        where: {
          employeeId: emp.id,
          appointment: {
            deletedAt: null,
            status: { in: [...SETTLED] },
          },
        },
        select: {
          id: true,
          amountRial: true,
          appointmentId: true,
          appointment: {
            select: {
              tipAmount: true,
              tipRecipientType: true,
              paidAt: true,
              scheduledAt: true,
            },
          },
        },
        orderBy: { id: 'desc' },
        take: 5,
      });

      const lines = tips.map((t) => ({
        allocationId: t.id,
        appointmentId: t.appointmentId,
        tipRecipientType: t.appointment.tipRecipientType,
        tipTotalToman: t.appointment.tipAmount
          ? toman(t.appointment.tipAmount)
          : null,
        myShareToman: toman(t.amountRial),
        // Service tip path unchanged: old === new === stored allocation
        oldShareToman: toman(t.amountRial),
        newShareToman: toman(t.amountRial),
        unchanged: true,
      }));

      if (tips.length === 0) {
        failures.push(
          `${emp.user.name} (SERVICE employeeId=${emp.id}): no tip allocations found`,
        );
      }

      serviceCases.push({
        employeeId: emp.id,
        name: emp.user.name,
        role: emp.user.role,
        tipAllocationCount: tips.length,
        lines,
        tipPathUnchanged: true,
      });
    }

    // Aggregate safety checks for specials: every line tax=200k and split 50
    for (const c of barberCases.filter((c) => c.policy === 'SPECIAL')) {
      for (const line of c.lines) {
        if (line.new.taxToman !== String(TAX_SPECIAL_TOMAN)) {
          failures.push(
            `SPECIAL safety: ${c.name} apt#${line.appointmentId} tax ${line.new.taxToman} != 200000`,
          );
        }
        if (line.new.splitPercent !== 50) {
          failures.push(
            `SPECIAL safety: ${c.name} apt#${line.appointmentId} split ${line.new.splitPercent} != 50`,
          );
        }
      }
    }
    for (const c of barberCases.filter((c) => c.policy === 'DEFAULT')) {
      for (const line of c.lines) {
        if (line.new.taxToman !== String(TAX_DEFAULT_TOMAN)) {
          failures.push(
            `DEFAULT safety: ${c.name} apt#${line.appointmentId} tax ${line.new.taxToman} != 80000`,
          );
        }
        if (line.new.splitPercent !== 40) {
          failures.push(
            `DEFAULT safety: ${c.name} apt#${line.appointmentId} split ${line.new.splitPercent} != 40`,
          );
        }
        // Normal barbers: new should equal old
        if (line.new.netShareToman !== line.old.netShareToman) {
          failures.push(
            `DEFAULT safety: ${c.name} apt#${line.appointmentId} new net ${line.new.netShareToman} != old ${line.old.netShareToman}`,
          );
        }
      }
    }

    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'READ_ONLY_SIMULATION',
      specialNamesExpected: SPECIAL_NAMES,
      specialsFound: specials.map((s) => ({
        id: s.id,
        name: s.user.name,
      })),
      normalsFound: normals.map((n) => ({ id: n.id, name: n.user.name })),
      servicesFound: services.map((s) => ({ id: s.id, name: s.user.name })),
      barberCases,
      serviceCases,
      failures,
      verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    };

    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`Wrote report: ${outPath}`);
    console.log(`VERDICT: ${report.verdict}`);
    if (failures.length) {
      console.error('FAILURES:');
      for (const f of failures) console.error(` - ${f}`);
      process.exitCode = 1;
    } else {
      console.log(
        JSON.stringify(
          {
            specials: report.specialsFound,
            normals: report.normalsFound,
            services: report.servicesFound,
            barberAppointmentLines: barberCases.reduce(
              (n, c) => n + c.lines.length,
              0,
            ),
            serviceTipLines: serviceCases.reduce(
              (n, c) => n + c.lines.length,
              0,
            ),
          },
          null,
          2,
        ),
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
