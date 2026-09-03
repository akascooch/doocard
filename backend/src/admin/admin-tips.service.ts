import {
  BadRequestException,
  ConflictException,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, TipRecipientType, TipSourceStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  computePersonalTipAllocations,
  computeTeamTipAllocations,
} from '../accounting/ledger-backfill.match';
import {
  formatJalaliFromUtcInstant,
  jalaliDateToTehranNoonUtc,
  jalaliRangeToTehranClosed,
  normalizeJalaliDigits,
} from '../common/utils/tehran-business-day';
import { CreateManualTipDto, PreviewManualTipDto } from './dto/manual-tip.dto';
import { TipAlertService } from '../sms/tip-alert.service';
import {
  buildManualTipNote,
  isSettledOnDifferentTehranDay,
} from '../common/utils/tip-ledger-description';

const SETTLED_APPOINTMENT_STATUSES = ['SETTLED', 'PAID', 'COMPLETED'] as const;

function tomanToRial(toman: number): bigint {
  if (!Number.isInteger(toman) || toman <= 0) {
    throw new BadRequestException('مبلغ انعام باید عدد صحیح مثبت به تومان باشد');
  }
  return BigInt(toman) * 10n;
}

function parseTeamMemberIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw.map(Number).filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
}

@Injectable()
export class AdminTipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tipAlertService: TipAlertService,
  ) {}

  private async assertEligibleServiceStaff(
    tx: Prisma.TransactionClient | PrismaService,
    employeeId: number,
  ) {
    const emp = await tx.employee.findUnique({
      where: { id: employeeId },
      include: { user: { select: { role: true, name: true } } },
    });
    if (!emp || !emp.isActive) {
      throw new BadRequestException(`پرسنل #${employeeId} یافت نشد یا غیرفعال است`);
    }
    if (emp.user.role !== UserRole.SERVICE) {
      throw new BadRequestException(
        'فقط پرسنل خدمات می‌توانند گیرنده انعام باشند؛ نقش‌های دیگر مجاز نیستند',
      );
    }
    return emp;
  }

  private async resolveTeamMembers(
    tx: Prisma.TransactionClient | PrismaService,
    tipType: TipRecipientType,
    dto: PreviewManualTipDto,
  ): Promise<{
    eligibleIds: number[];
    rejectedIds: number[];
    allocations: { employeeId: number; amountRial: bigint }[];
    amountRial: bigint;
    effectiveBusinessAt: Date;
    recipientEmployeeId: number | null;
  }> {
    const amountRial = tomanToRial(dto.amountToman);
    const effectiveBusinessAt = jalaliDateToTehranNoonUtc(dto.effectiveJalali);
    if (!effectiveBusinessAt) {
      throw new BadRequestException('تاریخ شمسی مؤثر نامعتبر است');
    }

    if (tipType === TipRecipientType.INDIVIDUAL) {
      if (!dto.recipientEmployeeId) {
        throw new BadRequestException('انعام فردی نیازمند انتخاب یک پرسنل خدمات است');
      }
      await this.assertEligibleServiceStaff(tx, dto.recipientEmployeeId);
      const allocations = computePersonalTipAllocations(
        amountRial,
        dto.recipientEmployeeId,
      ).map((r) => ({ employeeId: r.employeeId, amountRial: r.amountRial }));
      return {
        eligibleIds: [dto.recipientEmployeeId],
        rejectedIds: [],
        allocations,
        amountRial,
        effectiveBusinessAt,
        recipientEmployeeId: dto.recipientEmployeeId,
      };
    }

    const requested = parseTeamMemberIds(dto.teamMemberIds);
    if (requested.length === 0) {
      throw new BadRequestException(
        'برای انعام تیمی حداقل یک پرسنل خدمات انتخاب کنید',
      );
    }

    const rejectedIds: number[] = [];
    const eligibleIds: number[] = [];
    for (const id of requested) {
      try {
        await this.assertEligibleServiceStaff(tx, id);
        eligibleIds.push(id);
      } catch {
        rejectedIds.push(id);
      }
    }
    if (eligibleIds.length === 0) {
      throw new BadRequestException(
        'هیچ پرسنل خدمات واجد شرایطی برای تخصیص انعام تیمی وجود ندارد',
      );
    }

    const allocations = computeTeamTipAllocations(amountRial, null, eligibleIds).map(
      (r) => ({ employeeId: r.employeeId, amountRial: r.amountRial }),
    );
    return {
      eligibleIds,
      rejectedIds,
      allocations,
      amountRial,
      effectiveBusinessAt,
      recipientEmployeeId: null,
    };
  }

  async preview(dto: PreviewManualTipDto) {
    const resolved = await this.resolveTeamMembers(this.prisma, dto.tipType, dto);
    const allocationSum = resolved.allocations.reduce(
      (s, a) => s + a.amountRial,
      0n,
    );
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: resolved.eligibleIds } },
      include: { user: { select: { name: true, role: true } } },
    });
    const nameById = new Map(employees.map((e) => [e.id, e.user.name]));

    return {
      tipType: dto.tipType,
      amountToman: dto.amountToman,
      amountRial: resolved.amountRial.toString(),
      effectiveJalali: normalizeJalaliDigits(dto.effectiveJalali).replace(/-/g, '/'),
      effectiveBusinessAt: resolved.effectiveBusinessAt.toISOString(),
      eligibleEmployeeIds: resolved.eligibleIds,
      rejectedEmployeeIds: resolved.rejectedIds,
      remainderPolicy:
        'q = floor(A/n)، r = A mod n؛ r نفر اول (مرتب‌شده با id صعودی) q+1 ریال، بقیه q ریال',
      allocations: resolved.allocations.map((a) => ({
        employeeId: a.employeeId,
        employeeName: nameById.get(a.employeeId) ?? `کارمند #${a.employeeId}`,
        amountRial: a.amountRial.toString(),
        amountToman: (a.amountRial / 10n).toString(),
      })),
      allocationSumRial: allocationSum.toString(),
      reconciliationDifferenceRial: (resolved.amountRial - allocationSum).toString(),
      warnings: [] as string[],
      note: dto.note ?? null,
    };
  }

  async create(dto: CreateManualTipDto, createdByUserId: number) {
    if (!dto.idempotencyKey?.trim()) {
      throw new BadRequestException('کلید یکتایی (idempotencyKey) الزامی است');
    }

    const existing = await this.prisma.tipSource.findUnique({
      where: { idempotencyKey: dto.idempotencyKey.trim() },
      include: {
        allocations: true,
        recipientEmployee: { include: { user: { select: { name: true } } } },
      },
    });
    if (existing) {
      return {
        duplicate: true,
        tipSourceId: existing.id,
        tipType: existing.tipType,
        amountRial: existing.amountRial.toString(),
        allocationCount: existing.allocations.length,
        allocations: existing.allocations.map((a) => ({
          employeeId: a.employeeId,
          amountRial: a.amountRial.toString(),
        })),
      };
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const resolved = await this.resolveTeamMembers(tx, dto.tipType, dto);
        const allocationSum = resolved.allocations.reduce(
          (s, a) => s + a.amountRial,
          0n,
        );
        if (allocationSum !== resolved.amountRial) {
          throw new BadRequestException('مغایرت تخصیص انعام با مبلغ منبع');
        }

        const nameEmployees = await tx.employee.findMany({
          where: { id: { in: resolved.eligibleIds } },
          include: { user: { select: { name: true } } },
        });
        const nameById = new Map(nameEmployees.map((e) => [e.id, e.user.name]));
        const richNote = buildManualTipNote({
          tipType: dto.tipType,
          recipientName:
            resolved.recipientEmployeeId != null
              ? nameById.get(resolved.recipientEmployeeId) ?? null
              : null,
          teamMemberNames: resolved.eligibleIds.map(
            (id) => nameById.get(id) ?? `کارمند #${id}`,
          ),
          existingNote: dto.note,
        });

        const source = await tx.tipSource.create({
          data: {
            tipType: dto.tipType,
            amountRial: resolved.amountRial,
            effectiveBusinessAt: resolved.effectiveBusinessAt,
            createdByUserId,
            note: richNote,
            idempotencyKey: dto.idempotencyKey.trim(),
            recipientEmployeeId: resolved.recipientEmployeeId,
            teamMemberIds:
              dto.tipType === TipRecipientType.TEAM
                ? resolved.eligibleIds
                : Prisma.JsonNull,
            allocations: {
              create: resolved.allocations.map((a) => ({
                employeeId: a.employeeId,
                amountRial: a.amountRial,
              })),
            },
          },
          include: { allocations: true },
        });
        return source;
      });

      try {
        const tipTypeLabel =
          created.tipType === TipRecipientType.TEAM ? 'انعام تیمی' : 'انعام فردی';
        let barberName: string | null =
          created.tipType === TipRecipientType.TEAM ? 'تیم سالن' : null;
        if (created.recipientEmployeeId) {
          const recipient = await this.prisma.employee.findFirst({
            where: { id: created.recipientEmployeeId },
            include: { user: { select: { name: true } } },
          });
          barberName = recipient?.user?.name ?? barberName;
        }
        await this.tipAlertService.notifyTipRecipients({
          sourceKey: `manual-tip:${created.id}`,
          sourceLabel: `ثبت دستی ادمین — ${tipTypeLabel}`,
          customerName: null,
          barberName,
          allocations: created.allocations.map((a) => ({
            employeeId: a.employeeId,
            amountRial: a.amountRial,
          })),
        });
      } catch (e) {
        console.warn('[NOTIFY] Manual tip alert failed:', (e as any)?.message || e);
      }

      return {
        duplicate: false,
        tipSourceId: created.id,
        tipType: created.tipType,
        amountRial: created.amountRial.toString(),
        allocationCount: created.allocations.length,
        allocations: created.allocations.map((a) => ({
          employeeId: a.employeeId,
          amountRial: a.amountRial.toString(),
        })),
      };
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const again = await this.prisma.tipSource.findUnique({
          where: { idempotencyKey: dto.idempotencyKey.trim() },
          include: { allocations: true },
        });
        if (again) {
          return {
            duplicate: true,
            tipSourceId: again.id,
            tipType: again.tipType,
            amountRial: again.amountRial.toString(),
            allocationCount: again.allocations.length,
            allocations: again.allocations.map((a) => ({
              employeeId: a.employeeId,
              amountRial: a.amountRial.toString(),
            })),
          };
        }
      }
      throw err;
    }
  }

  async report(params: {
    fromJalali: string;
    toJalali: string;
    tipType?: 'ALL' | 'TEAM' | 'INDIVIDUAL';
    origin?: 'ALL' | 'APPOINTMENT' | 'MANUAL';
    employeeId?: number;
    paidState?: 'ALL' | 'PAID' | 'UNPAID';
    /** PAID_AT (default) matches ledger settlement day; SCHEDULED_AT matches Appointments page. */
    dateAxis?: 'PAID_AT' | 'SCHEDULED_AT';
    page?: number;
    pageSize?: number;
  }) {
    const range = jalaliRangeToTehranClosed(params.fromJalali, params.toJalali);
    if (!range) {
      throw new BadRequestException('بازه تاریخ شمسی نامعتبر است');
    }

    const tipTypeFilter =
      params.tipType && params.tipType !== 'ALL'
        ? (params.tipType as TipRecipientType)
        : undefined;
    const origin = params.origin ?? 'ALL';
    const paidState = params.paidState ?? 'ALL';
    const dateAxis = params.dateAxis === 'SCHEDULED_AT' ? 'SCHEDULED_AT' : 'PAID_AT';
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));

    type UnifiedRow = {
      sourceKey: string;
      origin: 'APPOINTMENT' | 'MANUAL';
      sourceId: number;
      tipType: TipRecipientType | null;
      amountRial: bigint;
      effectiveBusinessAt: Date;
      scheduledAt: Date | null;
      paidAt: Date | null;
      isSettledOnDifferentDay: boolean;
      note: string | null;
      creatorName: string | null;
      individualRecipientId: number | null;
      individualRecipientName: string | null;
      allocations: {
        id: number;
        employeeId: number;
        employeeName: string;
        employeeRole: string | null;
        amountRial: bigint;
        paidInSettlementId: number | null;
      }[];
    };

    const rows: UnifiedRow[] = [];

    if (origin === 'ALL' || origin === 'APPOINTMENT') {
      const dateFilter =
        dateAxis === 'SCHEDULED_AT'
          ? { scheduledAt: { gte: range.start, lte: range.endInclusive } }
          : { paidAt: { gte: range.start, lte: range.endInclusive } };

      const appointments = await this.prisma.appointment.findMany({
        where: {
          deletedAt: null,
          tipAmount: { not: null, gt: 0n },
          ...dateFilter,
          status: { in: [...SETTLED_APPOINTMENT_STATUSES] },
          ...(tipTypeFilter ? { tipRecipientType: tipTypeFilter } : {}),
        },
        include: {
          tipRecipientEmployee: { include: { user: { select: { name: true } } } },
          tipAllocations: {
            include: {
              employee: { include: { user: { select: { name: true, role: true } } } },
            },
          },
          paidByUser: { select: { name: true } },
        },
        orderBy:
          dateAxis === 'SCHEDULED_AT'
            ? { scheduledAt: 'asc' }
            : { paidAt: 'asc' },
      });

      for (const apt of appointments) {
        const axisAt =
          dateAxis === 'SCHEDULED_AT'
            ? apt.scheduledAt
            : apt.paidAt ?? apt.updatedAt;
        rows.push({
          sourceKey: `APPOINTMENT:${apt.id}`,
          origin: 'APPOINTMENT',
          sourceId: apt.id,
          tipType: apt.tipRecipientType,
          amountRial: apt.tipAmount ?? 0n,
          effectiveBusinessAt: axisAt,
          scheduledAt: apt.scheduledAt,
          paidAt: apt.paidAt,
          isSettledOnDifferentDay: isSettledOnDifferentTehranDay(
            apt.scheduledAt,
            apt.paidAt,
          ),
          note: null,
          creatorName: apt.paidByUser?.name ?? null,
          individualRecipientId: apt.tipRecipientEmployeeId,
          individualRecipientName: apt.tipRecipientEmployee?.user?.name ?? null,
          allocations: (apt.tipAllocations || []).map((a) => ({
            id: a.id,
            employeeId: a.employeeId,
            employeeName: a.employee?.user?.name ?? `#${a.employeeId}`,
            employeeRole: a.employee?.user?.role ?? null,
            amountRial: a.amountRial,
            paidInSettlementId: a.paidInSettlementId,
          })),
        });
      }
    }

    if (origin === 'ALL' || origin === 'MANUAL') {
      const manuals = await this.prisma.tipSource.findMany({
        where: {
          status: TipSourceStatus.ACTIVE,
          effectiveBusinessAt: { gte: range.start, lte: range.endInclusive },
          ...(tipTypeFilter ? { tipType: tipTypeFilter } : {}),
        },
        include: {
          createdBy: { select: { name: true } },
          recipientEmployee: { include: { user: { select: { name: true } } } },
          allocations: {
            include: {
              employee: { include: { user: { select: { name: true, role: true } } } },
            },
          },
        },
        orderBy: { effectiveBusinessAt: 'asc' },
      });

      for (const src of manuals) {
        rows.push({
          sourceKey: `MANUAL:${src.id}`,
          origin: 'MANUAL',
          sourceId: src.id,
          tipType: src.tipType,
          amountRial: src.amountRial,
          effectiveBusinessAt: src.effectiveBusinessAt,
          scheduledAt: null,
          paidAt: null,
          isSettledOnDifferentDay: false,
          note: src.note,
          creatorName: src.createdBy?.name ?? null,
          individualRecipientId: src.recipientEmployeeId,
          individualRecipientName: src.recipientEmployee?.user?.name ?? null,
          allocations: (src.allocations || []).map((a) => ({
            id: a.id,
            employeeId: a.employeeId,
            employeeName: a.employee?.user?.name ?? `#${a.employeeId}`,
            employeeRole: a.employee?.user?.role ?? null,
            amountRial: a.amountRial,
            paidInSettlementId: a.paidInSettlementId,
          })),
        });
      }
    }

    let filtered = rows;
    if (params.employeeId) {
      filtered = filtered.filter((r) =>
        r.allocations.some((a) => a.employeeId === params.employeeId),
      );
    }
    if (paidState === 'PAID') {
      filtered = filtered.filter(
        (r) =>
          r.allocations.length > 0 &&
          r.allocations.every((a) => a.paidInSettlementId != null),
      );
    } else if (paidState === 'UNPAID') {
      filtered = filtered.filter((r) =>
        r.allocations.some((a) => a.paidInSettlementId == null),
      );
    }

    filtered.sort(
      (a, b) =>
        a.effectiveBusinessAt.getTime() - b.effectiveBusinessAt.getTime() ||
        a.sourceId - b.sourceId,
    );

    let totalSourceAmount = 0n;
    let teamSourceCount = 0;
    let teamSourceAmount = 0n;
    let individualSourceCount = 0;
    let individualSourceAmount = 0n;
    let teamAllocated = 0n;
    let paidAllocationAmount = 0n;
    let unpaidAllocationAmount = 0n;
    let allocationRowCount = 0;
    let settledOnDifferentDayCount = 0;

    for (const r of filtered) {
      totalSourceAmount += r.amountRial;
      const allocSum = r.allocations.reduce((s, a) => s + a.amountRial, 0n);
      allocationRowCount += r.allocations.length;
      if (r.isSettledOnDifferentDay) settledOnDifferentDayCount += 1;
      if (r.tipType === TipRecipientType.TEAM) {
        teamSourceCount += 1;
        teamSourceAmount += r.amountRial;
        teamAllocated += allocSum;
      } else if (r.tipType === TipRecipientType.INDIVIDUAL) {
        individualSourceCount += 1;
        individualSourceAmount += r.amountRial;
      }
      for (const a of r.allocations) {
        if (a.paidInSettlementId != null) paidAllocationAmount += a.amountRial;
        else unpaidAllocationAmount += a.amountRial;
      }
    }

    const teamReconDiff = teamSourceAmount - teamAllocated;
    const total = filtered.length;
    const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

    return {
      fromJalali: normalizeJalaliDigits(params.fromJalali).replace(/-/g, '/'),
      toJalali: normalizeJalaliDigits(params.toJalali).replace(/-/g, '/'),
      dateAxis,
      summary: {
        sourceTransactionCount: total,
        totalSourceAmountRial: totalSourceAmount.toString(),
        teamSourceCount,
        teamSourceAmountRial: teamSourceAmount.toString(),
        individualSourceCount,
        individualSourceAmountRial: individualSourceAmount.toString(),
        teamAllocatedAmountRial: teamAllocated.toString(),
        teamReconciliationDifferenceRial: teamReconDiff.toString(),
        paidAllocationAmountRial: paidAllocationAmount.toString(),
        unpaidAllocationAmountRial: unpaidAllocationAmount.toString(),
        allocationRowCount,
        settledOnDifferentDayCount,
      },
      page,
      pageSize,
      total,
      items: pageRows.map((r) => {
        const allocated = r.allocations.reduce((s, a) => s + a.amountRial, 0n);
        const allPaid =
          r.allocations.length > 0 &&
          r.allocations.every((a) => a.paidInSettlementId != null);
        const anyUnpaid = r.allocations.some((a) => a.paidInSettlementId == null);
        return {
          sourceKey: r.sourceKey,
          origin: r.origin,
          sourceId: r.sourceId,
          tipType: r.tipType,
          amountRial: r.amountRial.toString(),
          effectiveBusinessAt: r.effectiveBusinessAt.toISOString(),
          effectiveJalali: formatJalaliFromUtcInstant(r.effectiveBusinessAt),
          scheduledAt: r.scheduledAt?.toISOString() ?? null,
          scheduledJalali: r.scheduledAt
            ? formatJalaliFromUtcInstant(r.scheduledAt)
            : null,
          paidAt: r.paidAt?.toISOString() ?? null,
          paidJalali: r.paidAt ? formatJalaliFromUtcInstant(r.paidAt) : null,
          isSettledOnDifferentDay: r.isSettledOnDifferentDay,
          note: r.note,
          creatorName: r.creatorName,
          individualRecipientId: r.individualRecipientId,
          individualRecipientName: r.individualRecipientName,
          allocationCount: r.allocations.length,
          allocatedAmountRial: allocated.toString(),
          reconciliationDifferenceRial: (r.amountRial - allocated).toString(),
          paymentStatus: allPaid ? 'PAID' : anyUnpaid ? 'UNPAID' : 'NONE',
          allocations: r.allocations.map((a) => ({
            id: a.id,
            employeeId: a.employeeId,
            employeeName: a.employeeName,
            employeeRole: a.employeeRole,
            amountRial: a.amountRial.toString(),
            paidInSettlementId: a.paidInSettlementId,
            paid: a.paidInSettlementId != null,
          })),
        };
      }),
    };
  }

  assertCanCreate(role: string) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('فقط ادمین می‌تواند انعام دستی ثبت کند');
    }
  }
}
