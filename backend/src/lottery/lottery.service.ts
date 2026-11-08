import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  LotteryArrearStatus,
  LotteryContributionStatus,
  LotteryCycleStatus,
  LotteryGroupStatus,
  LotteryMemberStatus,
  LotteryPayoutStatus,
  Prisma,
  TransactionType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChequeDueSmsReminderService } from '../sms/cheque-due-sms-reminder.service';
import { nextCycleOrder } from './lottery-order';
import {
  addMonthsYm,
  contribIdempotencyKey,
  EMPLOYEE_LOAN_INSTALLMENT_SOURCE_TYPE,
  LOTTERY_CONTRIBUTION_SOURCE_TYPE,
  LOTTERY_PAYOUT_SOURCE_TYPE,
  loanInstallmentIdempotencyKey,
  MAIN_TILL_ACCOUNT_NAME,
  payoutIdempotencyKey,
  prepaidIdempotencyKey,
} from '../common/constants/lottery.constants';

export type LotteryRunMode = 'dry-run' | 'live';

@Injectable()
export class LotteryService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCircleAccount(accountId: number) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: accountId, deletedAt: null, isActive: true },
    });
    if (!account) throw new BadRequestException('حساب دایره یافت نشد');
    if (account.name.trim() === MAIN_TILL_ACCOUNT_NAME) {
      throw new BadRequestException('حساب صندوق اصلی را نمی‌توان برای دایره قرعه‌کشی انتخاب کرد');
    }
    if (!account.isCircleAccount) {
      throw new BadRequestException('حساب باید با پرچم حساب دایره مشخص شده باشد');
    }
    return account;
  }

  listGroups() {
    return this.prisma.lotteryGroup.findMany({
      orderBy: { id: 'asc' },
      include: {
        circleAccount: { select: { id: true, name: true, isCircleAccount: true } },
        _count: { select: { members: true } },
      },
    });
  }

  async getGroup(id: number) {
    const group = await this.prisma.lotteryGroup.findUnique({
      where: { id },
      include: {
        circleAccount: { select: { id: true, name: true, balance: true, isCircleAccount: true } },
        members: {
          include: { employee: { include: { user: { select: { name: true, role: true } } } } },
          orderBy: { id: 'asc' },
        },
        cycles: { orderBy: { cycleIndex: 'desc' }, take: 5, include: { slots: { orderBy: { slotIndex: 'asc' } } } },
        arrears: { where: { status: { in: [LotteryArrearStatus.OPEN, LotteryArrearStatus.PARTIAL] } } },
      },
    });
    if (!group) throw new NotFoundException('گروه قرعه‌کشی یافت نشد');
    const isLoanGroup = group.circleAccountId == null;
    return {
      ...group,
      isLoanGroup,
      monthlyAmountRial: group.monthlyAmountRial.toString(),
      totalLoanAmountRial: group.totalLoanAmountRial?.toString() ?? null,
      startPeriodYm: group.startPeriodYm ?? null,
      members: group.members.map((m) => ({
        id: m.id,
        employeeId: m.employeeId,
        fullName: m.employee.user?.name ?? `کارمند #${m.employeeId}`,
        role: m.employee.user?.role,
        status: m.status,
        joinedAt: m.joinedAt,
        prepaidRial: m.prepaidRial.toString(),
      })),
    };
  }

  private normalizePeriodYm(raw?: string | null): string {
    const fallback = ChequeDueSmsReminderService.todayYmdTehran().slice(0, 7);
    if (!raw || !String(raw).trim()) return fallback;
    const value = String(raw).trim().replace(/\//g, '-');
    if (!/^\d{4}-\d{2}$/.test(value)) {
      throw new BadRequestException('ماه شروع باید به صورت YYYY-MM (میلادی مدنی تهران) باشد');
    }
    const month = Number(value.slice(5, 7));
    if (month < 1 || month > 12) throw new BadRequestException('ماه شروع نامعتبر است');
    return value;
  }

  private periodKeyToOccurredAt(periodKey: string): Date {
    const [y, m] = periodKey.split('-').map(Number);
    // Noon Asia/Tehran on the 1st of the Gregorian civil month.
    return new Date(Date.UTC(y, m - 1, 1, 8, 30, 0));
  }

  async createGroup(
    dto: {
      name: string;
      monthlyAmountRial: string | number;
      totalLoanAmountRial?: string | number | null;
      startPeriodYm?: string | null;
      employeeIds?: number[];
      cronDayOfMonth?: number;
      circleAccountId?: number | null;
    },
    userId: number,
  ) {
    const monthly = BigInt(dto.monthlyAmountRial);
    if (monthly <= 0n) throw new BadRequestException('مبلغ قسط ماهانه نامعتبر است');

    const hasCircle =
      dto.circleAccountId != null && Number.isFinite(Number(dto.circleAccountId)) && Number(dto.circleAccountId) > 0;
    if (hasCircle) {
      await this.assertCircleAccount(Number(dto.circleAccountId));
      const day = dto.cronDayOfMonth ?? 1;
      if (day < 1 || day > 28) throw new BadRequestException('روز اجرای کرون باید بین ۱ و ۲۸ باشد');
      return this.prisma.lotteryGroup.create({
        data: {
          name: dto.name.trim(),
          monthlyAmountRial: monthly,
          cronDayOfMonth: day,
          circleAccountId: Number(dto.circleAccountId),
          createdByUserId: userId,
        },
      });
    }

    // Employee-loan / installment group (no circle account, no cron payout).
    const totalRaw = dto.totalLoanAmountRial;
    const total =
      totalRaw == null || totalRaw === ''
        ? null
        : BigInt(totalRaw);
    if (total != null && total <= 0n) {
      throw new BadRequestException('مبلغ کل وام نامعتبر است');
    }
    const startPeriodYm = this.normalizePeriodYm(dto.startPeriodYm);
    const group = await this.prisma.lotteryGroup.create({
      data: {
        name: dto.name.trim(),
        monthlyAmountRial: monthly,
        cronDayOfMonth: dto.cronDayOfMonth && dto.cronDayOfMonth >= 1 && dto.cronDayOfMonth <= 28
          ? dto.cronDayOfMonth
          : 1,
        circleAccountId: null,
        totalLoanAmountRial: total,
        startPeriodYm,
        createdByUserId: userId,
      },
    });
    const employeeIds = (dto.employeeIds ?? []).map(Number).filter((n) => n > 0);
    if (employeeIds.length > 0) {
      await this.replaceMembers(group.id, employeeIds, { allowMultiGroup: true });
    }
    return this.getGroup(group.id);
  }

  async patchGroup(
    id: number,
    dto: { name?: string; cronDayOfMonth?: number; circleAccountId?: number },
  ) {
    const group = await this.prisma.lotteryGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('گروه قرعه‌کشی یافت نشد');
    if (dto.cronDayOfMonth != null && (dto.cronDayOfMonth < 1 || dto.cronDayOfMonth > 28)) {
      throw new BadRequestException('روز اجرای کرون باید بین ۱ و ۲۸ باشد');
    }
    if (dto.circleAccountId != null && dto.circleAccountId !== group.circleAccountId) {
      const blocked = await this.prisma.lotteryPayoutEvent.findFirst({
        where: { groupId: id, status: LotteryPayoutStatus.BLOCKED_INSUFFICIENT_POT },
      });
      if (blocked) throw new ConflictException('تا رفع پرداخت مسدود نمی‌توان حساب دایره را عوض کرد');
      await this.assertCircleAccount(dto.circleAccountId);
    }
    return this.prisma.lotteryGroup.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.cronDayOfMonth != null ? { cronDayOfMonth: dto.cronDayOfMonth } : {}),
        ...(dto.circleAccountId != null ? { circleAccountId: dto.circleAccountId } : {}),
      },
    });
  }

  async replaceMembers(
    groupId: number,
    employeeIds: number[],
    opts?: { allowMultiGroup?: boolean },
  ) {
    const group = await this.prisma.lotteryGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('گروه قرعه‌کشی یافت نشد');
    const uniqueIds = [...new Set(employeeIds.map(Number).filter((n) => n > 0))];
    const employees = await this.prisma.employee.findMany({
      where: {
        id: { in: uniqueIds },
        isActive: true,
        user: { role: { in: [UserRole.EMPLOYEE, UserRole.SERVICE] } },
      },
      include: { user: { select: { role: true, name: true } } },
    });
    if (employees.length !== uniqueIds.length) {
      throw new BadRequestException('فقط پرسنل فعال آرایشگر یا خدمات قابل عضویت هستند');
    }
    const loanMode = group.circleAccountId == null || opts?.allowMultiGroup === true;
    if (!loanMode) {
      const elsewhere = await this.prisma.lotteryMember.findMany({
        where: {
          employeeId: { in: uniqueIds },
          status: LotteryMemberStatus.ACTIVE,
          groupId: { not: groupId },
        },
        select: { employeeId: true },
      });
      if (elsewhere.length) {
        throw new ConflictException('هر پرسنل فقط می‌تواند در یک گروه فعال عضو باشد');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.lotteryMember.findMany({ where: { groupId } });
      const wanted = new Set(uniqueIds);
      for (const row of current) {
        if (!wanted.has(row.employeeId) && row.status === LotteryMemberStatus.ACTIVE) {
          await tx.lotteryMember.update({
            where: { id: row.id },
            data: { status: LotteryMemberStatus.EXITED, exitedAt: new Date() },
          });
        }
      }
      for (const emp of employees) {
        const existing = current.find((c) => c.employeeId === emp.id);
        if (!existing) {
          await tx.lotteryMember.create({
            data: { groupId, employeeId: emp.id, status: LotteryMemberStatus.ACTIVE },
          });
        } else if (existing.status === LotteryMemberStatus.EXITED) {
          await tx.lotteryMember.update({
            where: { id: existing.id },
            data: { status: LotteryMemberStatus.ACTIVE, exitedAt: null, joinedAt: new Date() },
          });
        }
      }
    });
    return this.getGroup(groupId);
  }

  async employeeOptions() {
    const rows = await this.prisma.employee.findMany({
      where: {
        isActive: true,
        user: { role: { in: [UserRole.EMPLOYEE, UserRole.SERVICE] } },
      },
      include: { user: { select: { name: true, role: true } } },
      orderBy: { id: 'asc' },
    });
    return rows.map((e) => ({
      id: e.id,
      fullName: e.user?.name ?? `کارمند #${e.id}`,
      role: e.user?.role,
    }));
  }

  /**
   * Apply this month's installment for every active member of a loan group.
   * Idempotent per (group, employee, periodKey) via unique
   * lottery_loan_installment_events rows. Event + ledger EXPENSE are written
   * in one interactive transaction per member so a uniqueness race rolls back
   * cleanly and returns ALREADY_APPLIED.
   */
  async applyMonthInstallments(
    groupId: number,
    dto: { periodKey?: string; confirm?: boolean },
    userId: number,
  ) {
    if (dto?.confirm !== true) {
      throw new BadRequestException('confirm باید true باشد');
    }
    const group = await this.prisma.lotteryGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('گروه یافت نشد');
    if (group.circleAccountId != null) {
      throw new BadRequestException('اعمال قسط وام فقط برای گروه‌های بدون حساب دایره مجاز است');
    }
    if (group.status !== LotteryGroupStatus.ACTIVE) {
      throw new BadRequestException('گروه فعال نیست');
    }
    const periodKey = this.normalizePeriodYm(dto.periodKey ?? group.startPeriodYm);
    if (group.startPeriodYm && periodKey < group.startPeriodYm) {
      throw new BadRequestException('این ماه قبل از شروع بازپرداخت گروه است');
    }
    const members = await this.prisma.lotteryMember.findMany({
      where: { groupId, status: LotteryMemberStatus.ACTIVE },
      include: { employee: { include: { user: { select: { name: true } } } } },
    });
    if (members.length === 0) throw new BadRequestException('عضوی برای اعمال قسط نیست');

    const amount = group.monthlyAmountRial;
    const occurredAt = this.periodKeyToOccurredAt(periodKey);
    const results: Array<{
      employeeId: number;
      fullName: string;
      status: 'APPLIED' | 'ALREADY_APPLIED';
      amountRial: string;
      transactionId: number;
    }> = [];

    for (const member of members) {
      const fullName = member.employee.user?.name ?? `کارمند #${member.employeeId}`;
      results.push(
        await this.applyOneLoanInstallment({
          groupId,
          groupName: group.name,
          memberId: member.id,
          employeeId: member.employeeId,
          fullName,
          periodKey,
          amount,
          occurredAt,
          userId,
        }),
      );
    }

    return {
      groupId,
      periodKey,
      monthlyAmountRial: amount.toString(),
      appliedCount: results.filter((r) => r.status === 'APPLIED').length,
      alreadyAppliedCount: results.filter((r) => r.status === 'ALREADY_APPLIED').length,
      results,
    };
  }

  private async resolveExistingLoanInstallment(params: {
    groupId: number;
    employeeId: number;
    periodKey: string;
    fullName: string;
  }): Promise<{
    employeeId: number;
    fullName: string;
    status: 'ALREADY_APPLIED';
    amountRial: string;
    transactionId: number;
  } | null> {
    const existing = await this.prisma.lotteryLoanInstallmentEvent.findUnique({
      where: {
        groupId_employeeId_periodKey: {
          groupId: params.groupId,
          employeeId: params.employeeId,
          periodKey: params.periodKey,
        },
      },
    });
    if (!existing?.transactionId) return null;
    return {
      employeeId: params.employeeId,
      fullName: params.fullName,
      status: 'ALREADY_APPLIED',
      amountRial: existing.amountRial.toString(),
      transactionId: existing.transactionId,
    };
  }

  private async applyOneLoanInstallment(params: {
    groupId: number;
    groupName: string;
    memberId: number;
    employeeId: number;
    fullName: string;
    periodKey: string;
    amount: bigint;
    occurredAt: Date;
    userId: number;
  }): Promise<{
    employeeId: number;
    fullName: string;
    status: 'APPLIED' | 'ALREADY_APPLIED';
    amountRial: string;
    transactionId: number;
  }> {
    const {
      groupId,
      groupName,
      memberId,
      employeeId,
      fullName,
      periodKey,
      amount,
      occurredAt,
      userId,
    } = params;
    const externalRef = loanInstallmentIdempotencyKey(groupId, employeeId, periodKey);

    const already = await this.resolveExistingLoanInstallment({
      groupId,
      employeeId,
      periodKey,
      fullName,
    });
    if (already) return already;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const event = await tx.lotteryLoanInstallmentEvent.create({
          data: {
            groupId,
            memberId,
            employeeId,
            periodKey,
            amountRial: amount,
            idempotencyKey: externalRef,
          },
        });
        const txn = await tx.transaction.create({
          data: {
            type: TransactionType.EXPENSE,
            amount,
            description: `قسط وام «${groupName}» دوره ${periodKey}`,
            sourceType: EMPLOYEE_LOAN_INSTALLMENT_SOURCE_TYPE,
            sourceId: memberId,
            employeeId,
            createdBy: userId,
            occurredAt,
            meta: {
              externalRef,
              lotteryGroupId: groupId,
              lotteryMemberId: memberId,
              employeeId,
              periodKey,
              installmentEventId: event.id,
              status: 'APPLIED',
            },
          },
        });
        await tx.lotteryLoanInstallmentEvent.update({
          where: { id: event.id },
          data: { transactionId: txn.id },
        });
        return {
          employeeId,
          fullName,
          status: 'APPLIED' as const,
          amountRial: amount.toString(),
          transactionId: txn.id,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.resolveExistingLoanInstallment({
          groupId,
          employeeId,
          periodKey,
          fullName,
        });
        if (raced) return raced;
      }
      throw error;
    }
  }

  async startCycle(groupId: number) {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.lotteryGroup.findUnique({ where: { id: groupId } });
      if (!group) throw new NotFoundException('گروه قرعه‌کشی یافت نشد');
      const activeCycle = await tx.lotteryCycle.findFirst({
        where: { groupId, status: LotteryCycleStatus.ACTIVE },
      });
      if (activeCycle) {
        throw new ConflictException('یک دوره فعال وجود دارد؛ ابتدا آن را ببندید');
      }
      const members = await tx.lotteryMember.findMany({
        where: { groupId, status: LotteryMemberStatus.ACTIVE, exitedAt: null },
      });
      if (members.length === 0) throw new BadRequestException('عضوی برای شروع دوره نیست');
      const lastCycle = await tx.lotteryCycle.findFirst({
        where: { groupId },
        orderBy: { cycleIndex: 'desc' },
        include: { slots: { orderBy: { slotIndex: 'asc' } } },
      });
      const order = nextCycleOrder(lastCycle?.slots ?? [], members);
      const periodStartYm = ChequeDueSmsReminderService.todayYmdTehran().slice(0, 7);
      const cycle = await tx.lotteryCycle.create({
        data: {
          groupId,
          cycleIndex: (lastCycle?.cycleIndex ?? 0) + 1,
          status: LotteryCycleStatus.ACTIVE,
          memberCount: order.length,
          periodStartYm,
        },
      });
      const slots = [];
      for (let i = 0; i < order.length; i += 1) {
        const slot = await tx.lotterySlot.create({
          data: {
            cycleId: cycle.id,
            slotIndex: i + 1,
            memberId: order[i],
            periodKey: addMonthsYm(periodStartYm, i),
          },
        });
        slots.push(slot);
      }
      const memberById = new Map(members.map((m) => [m.id, m]));
      return {
        cycleId: cycle.id,
        cycleIndex: cycle.cycleIndex,
        memberCount: cycle.memberCount,
        slots: slots.map((s) => ({
          slotIndex: s.slotIndex,
          memberId: s.memberId,
          employeeId: memberById.get(s.memberId)?.employeeId,
          periodKey: s.periodKey,
        })),
      };
    });
  }

  async previewNextCycle(groupId: number, cycleId: number) {
    const cycle = await this.prisma.lotteryCycle.findFirst({
      where: { id: cycleId, groupId },
      include: { slots: { orderBy: { slotIndex: 'asc' } } },
    });
    if (!cycle) throw new NotFoundException('دوره یافت نشد');
    const members = await this.prisma.lotteryMember.findMany({
      where: { groupId, status: LotteryMemberStatus.ACTIVE, exitedAt: null },
    });
    const order = nextCycleOrder(cycle.slots, members);
    return { memberIds: order, memberCount: order.length };
  }

  async topUpPrepaid(
    memberId: number,
    dto: { amountRial: string | number; note?: string; circleAccountId: number; idempotencyKey?: string },
    userId: number,
  ) {
    const amount = BigInt(dto.amountRial);
    if (amount <= 0n) throw new BadRequestException('مبلغ شارژ نامعتبر است');
    const account = await this.assertCircleAccount(dto.circleAccountId);
    const member = await this.prisma.lotteryMember.findUnique({
      where: { id: memberId },
      include: { group: true },
    });
    if (!member || member.status !== LotteryMemberStatus.ACTIVE) {
      throw new NotFoundException('عضو فعال یافت نشد');
    }
    if (member.group.circleAccountId !== account.id) {
      throw new BadRequestException('حساب باید همان حساب دایره گروه باشد');
    }
    const clientKey = dto.idempotencyKey?.trim() || `${Date.now()}`;
    const externalRef = prepaidIdempotencyKey(memberId, clientKey);
    const existing = await this.prisma.transaction.findFirst({
      where: { meta: { path: ['externalRef'], equals: externalRef }, deletedAt: null },
    });
    if (existing) {
      return { duplicate: true, transactionId: existing.id, prepaidRial: member.prepaidRial.toString() };
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.create({
        data: {
          type: TransactionType.INCOME,
          amount,
          description: dto.note?.trim() || `شارژ پیش‌پرداخت صندوق عضو #${memberId}`,
          sourceType: LOTTERY_CONTRIBUTION_SOURCE_TYPE,
          sourceId: memberId,
          accountId: account.id,
          createdBy: userId,
          meta: { externalRef, lotteryMemberId: memberId, isPrepaidTopUp: true },
        },
      });
      await tx.bankAccount.update({
        where: { id: account.id },
        data: { balance: { increment: amount } },
      });
      const updated = await tx.lotteryMember.update({
        where: { id: memberId },
        data: { prepaidRial: { increment: amount } },
      });
      return { transactionId: txn.id, prepaidRial: updated.prepaidRial.toString() };
    });
    return { duplicate: false, ...result };
  }

  async me(userId: number) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new ForbiddenException('پروفایل کارمند یافت نشد');
    const memberships = await this.prisma.lotteryMember.findMany({
      where: { employeeId: employee.id, status: LotteryMemberStatus.ACTIVE },
      include: {
        group: true,
        slots: {
          include: { cycle: true },
        },
      },
    });
    if (memberships.length > 1) {
      throw new UnprocessableEntityException({
        code: 'MULTIPLE_GROUPS_UNSUPPORTED',
        message: 'عضویت همزمان در چند گروه در نسخه فعلی پشتیبانی نمی‌شود',
      });
    }
    if (memberships.length === 0) {
      return { group: null };
    }
    const membership = memberships[0];
    const cycle = await this.prisma.lotteryCycle.findFirst({
      where: { groupId: membership.groupId, status: LotteryCycleStatus.ACTIVE },
      include: {
        slots: {
          orderBy: { slotIndex: 'asc' },
          include: { member: { include: { employee: { include: { user: { select: { name: true } } } } } } },
        },
      },
    });
    const mySlot = cycle?.slots.find((s) => s.memberId === membership.id) ?? null;
    const contributions = await this.prisma.lotteryContributionEvent.findMany({
      where: { memberId: membership.id },
      orderBy: { periodKey: 'asc' },
    });
    const arrears = await this.prisma.lotteryArrear.findMany({
      where: {
        memberId: membership.id,
        status: { in: [LotteryArrearStatus.OPEN, LotteryArrearStatus.PARTIAL] },
      },
    });
    const arrearsRial = arrears.reduce((s, a) => s + a.amountRial, 0n);
    return {
      group: {
        id: membership.group.id,
        name: membership.group.name,
        monthlyAmountRial: membership.group.monthlyAmountRial.toString(),
      },
      cycle: cycle
        ? { id: cycle.id, cycleIndex: cycle.cycleIndex, status: cycle.status }
        : null,
      mySlot: mySlot ? { slotIndex: mySlot.slotIndex, periodKey: mySlot.periodKey } : null,
      queue: (cycle?.slots ?? []).map((s) => ({
        slotIndex: s.slotIndex,
        periodKey: s.periodKey,
        displayName: maskStaffName(s.member.employee.user?.name, s.member.employeeId),
      })),
      contributions: contributions.map((c) => ({
        periodKey: c.periodKey,
        status: c.status,
        amountRial: c.amountRial.toString(),
      })),
      arrearsRial: arrearsRial.toString(),
      history: [],
    };
  }

  async runGroupPeriod(
    groupId: number,
    opts: { mode: LotteryRunMode; periodKey?: string; now?: Date },
  ) {
    const periodKey = opts.periodKey ?? ChequeDueSmsReminderService.todayYmdTehran(opts.now).slice(0, 7);
    const dry = opts.mode === 'dry-run';
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "lottery_groups" WHERE id = ${groupId} FOR UPDATE`;
        const group = await tx.lotteryGroup.findUnique({ where: { id: groupId } });
        if (!group || group.status !== LotteryGroupStatus.ACTIVE) {
          return { skipped: true, reason: 'no-active-group', periodKey };
        }
        const cycle = await tx.lotteryCycle.findFirst({
          where: { groupId, status: LotteryCycleStatus.ACTIVE },
          include: { slots: true },
        });
        if (!cycle) return { skipped: true, reason: 'no-active-cycle', periodKey };
        const slot = cycle.slots.find((s) => s.periodKey === periodKey);
        if (!slot) return { skipped: true, reason: 'period-not-in-cycle', periodKey };

        const members = await tx.lotteryMember.findMany({
          where: { groupId, status: LotteryMemberStatus.ACTIVE },
        });
        const plannedContrib: Array<{ memberId: number; status: string; amountRial: string }> = [];
        let posted = 0;
        let arrears = 0;

        for (const member of members) {
          const key = contribIdempotencyKey(groupId, cycle.id, periodKey, member.id);
          const existing = await tx.lotteryContributionEvent.findUnique({ where: { idempotencyKey: key } });
          if (existing) {
            plannedContrib.push({
              memberId: member.id,
              status: existing.status,
              amountRial: existing.amountRial.toString(),
            });
            continue;
          }
          if (member.prepaidRial >= group.monthlyAmountRial) {
            plannedContrib.push({
              memberId: member.id,
              status: 'POSTED',
              amountRial: group.monthlyAmountRial.toString(),
            });
            if (!dry) {
              if (member.prepaidRial > 0n) {
                await tx.lotteryMember.update({
                  where: { id: member.id },
                  data: { prepaidRial: { decrement: group.monthlyAmountRial } },
                });
              }
              await tx.lotteryContributionEvent.create({
                data: {
                  groupId,
                  cycleId: cycle.id,
                  memberId: member.id,
                  periodKey,
                  amountRial: group.monthlyAmountRial,
                  status: LotteryContributionStatus.POSTED,
                  idempotencyKey: key,
                },
              });
            }
            posted += 1;
          } else {
            const remaining = group.monthlyAmountRial - member.prepaidRial;
            plannedContrib.push({
              memberId: member.id,
              status: 'ARREARS',
              amountRial: remaining.toString(),
            });
            if (!dry) {
              if (member.prepaidRial > 0n) {
                await tx.lotteryMember.update({
                  where: { id: member.id },
                  data: { prepaidRial: 0n },
                });
              }
              const event = await tx.lotteryContributionEvent.create({
                data: {
                  groupId,
                  cycleId: cycle.id,
                  memberId: member.id,
                  periodKey,
                  amountRial: remaining,
                  status: LotteryContributionStatus.ARREARS,
                  idempotencyKey: key,
                },
              });
              await tx.lotteryArrear.upsert({
                where: {
                  memberId_cycleId_periodKey: {
                    memberId: member.id,
                    cycleId: cycle.id,
                    periodKey,
                  },
                },
                update: { amountRial: remaining, originalRial: remaining, status: LotteryArrearStatus.OPEN },
                create: {
                  memberId: member.id,
                  groupId,
                  cycleId: cycle.id,
                  periodKey,
                  amountRial: remaining,
                  originalRial: remaining,
                  status: LotteryArrearStatus.OPEN,
                  contributionEventId: event.id,
                },
              });
            }
            arrears += 1;
          }
        }

        const postedRows = dry
          ? plannedContrib.filter((c) => c.status === 'POSTED')
          : await tx.lotteryContributionEvent.findMany({
              where: { cycleId: cycle.id, periodKey, status: LotteryContributionStatus.POSTED },
            });
        const collectedRial = dry
          ? postedRows.reduce((s, c) => s + BigInt(c.amountRial), 0n)
          : postedRows.reduce((s, c) => s + (c as { amountRial: bigint }).amountRial, 0n);
        const expected = group.monthlyAmountRial * BigInt(cycle.memberCount);
        const shortfall = expected > collectedRial ? expected - collectedRial : 0n;
        const payoutKey = payoutIdempotencyKey(groupId, cycle.id, periodKey);
        const existingPayout = await tx.lotteryPayoutEvent.findUnique({ where: { idempotencyKey: payoutKey } });
        const account = await tx.bankAccount.findUnique({ where: { id: group.circleAccountId } });
        const blocked = (account?.balance ?? 0n) < collectedRial;
        const plannedPayout = {
          memberId: slot.memberId,
          amountRial: collectedRial.toString(),
          blocked,
          collectedRial: collectedRial.toString(),
          payoutShortfallRial: shortfall.toString(),
        };

        if (dry) {
          return {
            dryRun: true,
            groupId,
            cycleId: cycle.id,
            periodKey,
            plannedContrib,
            plannedPayout,
          };
        }
        if (existingPayout) {
          return {
            dryRun: false,
            groupId,
            cycleId: cycle.id,
            periodKey,
            posted,
            arrears,
            payoutStatus: existingPayout.status,
            txnIds: existingPayout.transactionId ? [existingPayout.transactionId] : [],
          };
        }

        let txnId: number | null = null;
        let status: LotteryPayoutStatus = LotteryPayoutStatus.POSTED;
        if (blocked) {
          status = LotteryPayoutStatus.BLOCKED_INSUFFICIENT_POT;
        } else if (collectedRial > 0n) {
          const txn = await tx.transaction.create({
            data: {
              type: TransactionType.EXPENSE,
              amount: collectedRial,
              description: `پرداخت صندوق قرعه‌کشی دوره ${cycle.cycleIndex} ${periodKey}`,
              sourceType: LOTTERY_PAYOUT_SOURCE_TYPE,
              sourceId: slot.id,
              accountId: group.circleAccountId,
              meta: { externalRef: payoutKey, lotteryGroupId: groupId, periodKey },
            },
          });
          txnId = txn.id;
          await tx.bankAccount.update({
            where: { id: group.circleAccountId },
            data: { balance: { decrement: collectedRial } },
          });
        }
        const payout = await tx.lotteryPayoutEvent.create({
          data: {
            groupId,
            cycleId: cycle.id,
            slotId: slot.id,
            memberId: slot.memberId,
            periodKey,
            amountRial: collectedRial,
            collectedRial,
            payoutShortfallRial: shortfall,
            status,
            idempotencyKey: payoutKey,
            transactionId: txnId,
          },
        });
        return {
          dryRun: false,
          groupId,
          cycleId: cycle.id,
          periodKey,
          posted,
          arrears,
          payoutStatus: payout.status,
          txnIds: txnId ? [txnId] : [],
        };
      },
      { timeout: 30_000 },
    );
  }
}

export function maskStaffName(name: string | null | undefined, employeeId: number): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return `کارمند #${employeeId}`;
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? `${parts[parts.length - 1][0]}.` : '';
  return `${first}.${last}`.replace(/\.$/, '.') || `کارمند #${employeeId}`;
}
