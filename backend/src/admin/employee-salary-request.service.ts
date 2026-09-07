import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeSalaryRequestStatus,
  EmployeeSalaryRequestType,
  Prisma,
  TransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import {
  CANONICAL_EMPLOYEE_WITHDRAWAL_CATEGORY_ID,
  SALARY_REQUEST_SOURCE_TYPE,
} from '../common/constants/employee-commission.constants';
import { jalaliRangeToTehranClosed } from '../common/utils/tehran-business-day';
import {
  calculateEmployeeSalaryPreview,
  EmployeeSalaryPreviewResult,
  EmployeeSalaryService,
  ServiceTipLineItem,
} from './employee-salary.service';
import {
  buildSalaryBreakdownFromPreview,
  buildSalaryBreakdownFromSnapshot,
  SalaryBreakdownDto,
} from '../common/dto/salary-breakdown.dto';

export interface CreateSalaryRequestInput {
  requestType: EmployeeSalaryRequestType;
  upToJalali: string;
  periodStartJalali?: string;
  requestedAmountRial: string | number | bigint;
  destinationNote?: string;
  allowNegative?: boolean;
}

function extractTipLinesFromSnapshot(snapshot: unknown): ServiceTipLineItem[] | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const tipLines = (snapshot as { tipLines?: unknown }).tipLines;
  if (!Array.isArray(tipLines)) return null;
  return tipLines as ServiceTipLineItem[];
}

/** Prisma BigInt fields must be strings before Express JSON.stringify. */
function serializeSalaryRequest<T extends {
  requestedAmountRial: bigint;
  availableAtRequestRial: bigint;
  snapshotJson?: unknown;
}>(row: T) {
  const breakdown: SalaryBreakdownDto | null = buildSalaryBreakdownFromSnapshot(
    row.snapshotJson,
    {
      requestedAmountRial: row.requestedAmountRial.toString(),
      availableAtRequestRial: row.availableAtRequestRial.toString(),
    },
  );
  const tipLines = extractTipLinesFromSnapshot(row.snapshotJson);
  return {
    ...row,
    requestedAmountRial: row.requestedAmountRial.toString(),
    availableAtRequestRial: row.availableAtRequestRial.toString(),
    breakdown,
    tipLines,
    tipLinesAvailable: tipLines != null && tipLines.length > 0,
  };
}

@Injectable()
export class EmployeeSalaryRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeSalaryService: EmployeeSalaryService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  private async resolveEmployeeForUser(userId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!employee) {
      throw new NotFoundException('پروفایل کارمند یافت نشد');
    }
    if (employee.user.role !== 'EMPLOYEE' && employee.user.role !== 'SERVICE') {
      throw new ForbiddenException('فقط کارمندان و پرسنل خدمات می‌توانند درخواست ثبت کنند');
    }
    return employee;
  }

  private async buildPreviewForEmployee(
    employeeId: number,
    fromJalali: string,
    toJalali: string,
  ): Promise<EmployeeSalaryPreviewResult> {
    return calculateEmployeeSalaryPreview(this.prisma, {
      employeeId,
      fromJalali,
      toJalali,
    });
  }

  async createForAuthenticatedUser(userId: number, input: CreateSalaryRequestInput) {
    const employee = await this.resolveEmployeeForUser(userId);
    const fromJalali =
      input.periodStartJalali ||
      (await this.suggestPeriodStart(employee.id)) ||
      input.upToJalali;

    const preview = await this.buildPreviewForEmployee(
      employee.id,
      fromJalali,
      input.upToJalali,
    );

    const available = BigInt(preview.netPayable);
    const requested = BigInt(input.requestedAmountRial);

    if (requested <= 0n) {
      throw new BadRequestException('مبلغ درخواست باید بزرگتر از صفر باشد');
    }

    const isAdvance = input.requestType === EmployeeSalaryRequestType.ADVANCE;
    if (!isAdvance && requested > available) {
      throw new BadRequestException(
        'مبلغ درخواست بیشتر از موجودی قابل برداشت است (برداشت حقوق نمی‌تواند منفی شود)',
      );
    }
    if (isAdvance && requested > available && !input.allowNegative) {
      throw new BadRequestException(
        'برای مساعده بیش از موجودی، تأیید allowNegative الزامی است',
      );
    }

    const created = await this.prisma.employeeSalaryRequest.create({
      data: {
        employeeId: employee.id,
        requestType: input.requestType,
        status: EmployeeSalaryRequestStatus.PENDING,
        upToJalali: input.upToJalali,
        periodStartJalali: fromJalali,
        requestedAmountRial: requested,
        availableAtRequestRial: available,
        snapshotJson: preview as unknown as Prisma.InputJsonValue,
        destinationNote: input.destinationNote,
        allowNegative: Boolean(input.allowNegative && isAdvance),
      },
    });

    await this.notifyAdminsOfNewSalaryRequest(employee.user.name, created.id);

    return serializeSalaryRequest(created);
  }

  private async notifyAdminsOfNewSalaryRequest(employeeName: string, requestId: number) {
    const title = 'درخواست حقوق جدید';
    const message = `یک درخواست حقوق جدید از طرف ${employeeName} ثبت شد.`;

    try {
      const notification = await this.notificationsService.create({
        title,
        message,
        type: 'GENERAL',
        roleTarget: 'ADMIN',
        relatedEntity: `salary-request:${requestId}`,
      });
      this.notificationsGateway.sendToRole('ADMIN', notification);

      await this.pushNotificationsService.sendToRole('ADMIN', {
        title,
        body: message,
        icon: '/logo/logo-512.png',
        data: {
          url: '/dashboard/admin/employee-salary',
          salaryRequestId: requestId,
        },
      });
    } catch (error: any) {
      console.error('Failed to notify admins of salary request:', error?.message);
    }
  }

  private async notifyEmployeeOfSalaryRequestDecision(
    employeeUserId: number,
    requestId: number,
    approved: boolean,
  ) {
    const title = approved ? 'درخواست حقوق تایید شد' : 'درخواست حقوق رد شد';
    const message = approved
      ? 'درخواست حقوق شما تایید شد.'
      : 'درخواست حقوق شما رد شد.';

    try {
      const notification = await this.notificationsService.create({
        title,
        message,
        type: 'GENERAL',
        userIdTarget: employeeUserId,
        relatedEntity: `salary-request:${requestId}`,
      });
      this.notificationsGateway.sendToUser(employeeUserId, notification);

      await this.pushNotificationsService.sendToUser(employeeUserId, {
        title,
        body: message,
        icon: '/logo/logo-512.png',
        data: {
          url: '/dashboard/employee/salary-request',
          salaryRequestId: requestId,
        },
      });
    } catch (error: any) {
      console.error('Failed to notify employee of salary request decision:', error?.message);
    }
  }

  private async suggestPeriodStart(employeeId: number): Promise<string | null> {
    const last = await this.prisma.employeeCommissionSettlement.findFirst({
      where: { employeeId, status: 'ACTIVE' },
      orderBy: { periodEndAt: 'desc' },
    });
    return last?.periodEndJalali ?? null;
  }

  async listMine(userId: number) {
    const employee = await this.resolveEmployeeForUser(userId);
    const rows = await this.prisma.employeeSalaryRequest.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(serializeSalaryRequest);
  }

  async summaryForAuthenticatedUser(
    userId: number,
    fromJalali: string,
    toJalali: string,
  ) {
    const employee = await this.resolveEmployeeForUser(userId);
    const preview = await this.buildPreviewForEmployee(
      employee.id,
      fromJalali,
      toJalali,
    );
    const requests = await this.prisma.employeeSalaryRequest.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const settlements = await this.employeeSalaryService.getSettlementHistory(
      employee.id,
    );

    const teamShare = preview.isServiceStaff ? '0' : preview.teamShareIncome;
    const netPayableBig = BigInt(preview.netPayable);
    const isPayableDebt = netPayableBig < 0n;

    return {
      preview: {
        ...preview,
        teamShareIncome: teamShare,
        tipIncomeLabel: preview.isServiceStaff ? 'انعام' : 'سهم تیمی',
        /** Raw net — may be negative; never clamped to zero. */
        withdrawable: preview.netPayable,
        /** Negative withdrawable is shown as payable debt, not zeroed. */
        isPayableDebt,
        payableLabel: isPayableDebt ? 'بدهی قابل تسویه' : 'قابل برداشت',
        breakdown: buildSalaryBreakdownFromPreview(preview),
      },
      requests: requests.map(serializeSalaryRequest),
      settlements,
    };
  }

  async listAdmin(status?: EmployeeSalaryRequestStatus) {
    const rows = await this.prisma.employeeSalaryRequest.findMany({
      where: status ? { status } : undefined,
      include: {
        employee: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(serializeSalaryRequest);
  }

  /**
   * Single request detail for admin. tipLines come only from snapshotJson
   * (no live recompute — avoids misleading diffs vs historical pay state).
   */
  async getAdminById(id: number) {
    const req = await this.prisma.employeeSalaryRequest.findUnique({
      where: { id },
      include: {
        employee: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
    });
    if (!req) throw new NotFoundException('درخواست یافت نشد');
    const serialized = serializeSalaryRequest(req);
    const tipLines = serialized.tipLines;
    return {
      ...serialized,
      tipDetails: {
        available: tipLines != null,
        tipLines: tipLines ?? [],
        message:
          tipLines == null
            ? 'جزئیات انعام برای این درخواست قدیمی ذخیره نشده است.'
            : tipLines.length === 0
              ? 'در این اسنپ‌شات هیچ ردیف انعامی ثبت نشده است.'
              : null,
      },
    };
  }

  async approve(id: number, adminUserId: number) {
    const req = await this.getRequestOrThrow(id);
    if (req.status !== EmployeeSalaryRequestStatus.PENDING) {
      throw new BadRequestException('فقط درخواست‌های در انتظار قابل تأیید هستند');
    }
    const updated = await this.prisma.employeeSalaryRequest.update({
      where: { id },
      data: {
        status: EmployeeSalaryRequestStatus.APPROVED,
        reviewedByUserId: adminUserId,
        reviewedAt: new Date(),
      },
    });

    const employeeUserId = await this.resolveEmployeeUserId(req.employeeId);
    if (employeeUserId) {
      await this.notifyEmployeeOfSalaryRequestDecision(employeeUserId, id, true);
    }

    return serializeSalaryRequest(updated);
  }

  async reject(id: number, adminUserId: number, reason?: string) {
    const req = await this.getRequestOrThrow(id);
    if (
      req.status !== EmployeeSalaryRequestStatus.PENDING &&
      req.status !== EmployeeSalaryRequestStatus.APPROVED
    ) {
      throw new BadRequestException('وضعیت درخواست برای رد مناسب نیست');
    }
    const updated = await this.prisma.employeeSalaryRequest.update({
      where: { id },
      data: {
        status: EmployeeSalaryRequestStatus.REJECTED,
        reviewedByUserId: adminUserId,
        reviewedAt: new Date(),
        rejectionReason: reason || null,
      },
    });

    const employeeUserId = await this.resolveEmployeeUserId(req.employeeId);
    if (employeeUserId) {
      await this.notifyEmployeeOfSalaryRequestDecision(employeeUserId, id, false);
    }

    return serializeSalaryRequest(updated);
  }

  async cancel(id: number, actorUserId: number, asAdmin: boolean) {
    const req = await this.getRequestOrThrow(id);
    if (
      req.status !== EmployeeSalaryRequestStatus.PENDING &&
      req.status !== EmployeeSalaryRequestStatus.APPROVED
    ) {
      throw new BadRequestException('فقط درخواست‌های باز قابل لغو هستند');
    }
    if (!asAdmin) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: req.employeeId },
      });
      if (!employee || employee.userId !== actorUserId) {
        throw new ForbiddenException('اجازه لغو این درخواست را ندارید');
      }
    }
    const updated = await this.prisma.employeeSalaryRequest.update({
      where: { id },
      data: { status: EmployeeSalaryRequestStatus.CANCELLED },
    });
    return serializeSalaryRequest(updated);
  }

  async previewPayDiff(id: number) {
    const req = await this.getRequestOrThrow(id);
    const fromJalali = req.periodStartJalali || req.upToJalali;
    const live = await this.buildPreviewForEmployee(
      req.employeeId,
      fromJalali,
      req.upToJalali,
    );
    return {
      requestId: id,
      snapshotAmount: req.requestedAmountRial.toString(),
      snapshotAvailable: req.availableAtRequestRial.toString(),
      liveAvailable: live.netPayable,
      livePreview: live,
      diffRial: (BigInt(live.netPayable) - req.availableAtRequestRial).toString(),
    };
  }

  async pay(
    id: number,
    adminUserId: number,
    bankAccountId: number,
  ) {
    const req = await this.getRequestOrThrow(id);
    if (
      req.status !== EmployeeSalaryRequestStatus.APPROVED &&
      req.status !== EmployeeSalaryRequestStatus.PENDING
    ) {
      throw new BadRequestException('درخواست در وضعیت قابل پرداخت نیست');
    }

    const fromJalali = req.periodStartJalali || req.upToJalali;
    const live = await this.buildPreviewForEmployee(
      req.employeeId,
      fromJalali,
      req.upToJalali,
    );
    const liveAvailable = BigInt(live.netPayable);
    const amount = req.requestedAmountRial;

    const isAdvance = req.requestType === EmployeeSalaryRequestType.ADVANCE;
    if (!isAdvance && amount > liveAvailable) {
      throw new BadRequestException(
        'موجودی فعلی کمتر از مبلغ اسنپ‌شات است؛ پرداخت حقوق مسدود شد',
      );
    }
    if (isAdvance && amount > liveAvailable && !req.allowNegative) {
      throw new BadRequestException(
        'مساعده بیش از موجودی بدون اجازه منفی قابل پرداخت نیست',
      );
    }

    const account = await this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, deletedAt: null },
    });
    if (!account) {
      throw new BadRequestException('حساب بانکی یافت نشد');
    }

    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.transaction.create({
        data: {
          type: TransactionType.EXPENSE,
          amount,
          currency: 'IRR',
          description: `پرداخت درخواست حقوق #${id}`,
          categoryId: CANONICAL_EMPLOYEE_WITHDRAWAL_CATEGORY_ID,
          accountId: bankAccountId,
          employeeId: req.employeeId,
          sourceType: SALARY_REQUEST_SOURCE_TYPE,
          sourceId: id,
          paymentMethod: 'TRANSFER',
          occurredAt: new Date(),
          createdBy: adminUserId,
          meta: {
            salaryRequestId: id,
            requestType: req.requestType,
            snapshotAmount: amount.toString(),
            liveAvailable: liveAvailable.toString(),
          } as Prisma.InputJsonValue,
        },
      });

      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { balance: { decrement: amount } },
      });

      const paid = await tx.employeeSalaryRequest.update({
        where: { id },
        data: {
          status: EmployeeSalaryRequestStatus.PAID,
          paidByUserId: adminUserId,
          paidAt: new Date(),
          paidBankAccountId: bankAccountId,
          paymentTransactionId: expense.id,
          reviewedByUserId: req.reviewedByUserId ?? adminUserId,
          reviewedAt: req.reviewedAt ?? new Date(),
        },
      });
      return serializeSalaryRequest(paid);
    });
  }

  private async resolveEmployeeUserId(employeeId: number): Promise<number | null> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { userId: true },
    });
    return employee?.userId ?? null;
  }

  private async getRequestOrThrow(id: number) {
    const req = await this.prisma.employeeSalaryRequest.findUnique({
      where: { id },
    });
    if (!req) throw new NotFoundException('درخواست یافت نشد');
    return req;
  }

  async listMyWithdrawals(
    userId: number,
    page = 1,
    limit = 20,
    fromJalali?: string,
    toJalali?: string,
  ) {
    const employee = await this.resolveEmployeeForUser(userId);
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Math.min(100, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 20));
    const skip = (safePage - 1) * safeLimit;

    const hasFrom = fromJalali != null && fromJalali.trim() !== '';
    const hasTo = toJalali != null && toJalali.trim() !== '';
    if (hasFrom !== hasTo) {
      throw new BadRequestException('from and to (Jalali dates) must be provided together');
    }

    const where: Prisma.TransactionWhereInput = {
      deletedAt: null,
      type: TransactionType.EXPENSE,
      employeeId: employee.id,
    };

    if (hasFrom && hasTo) {
      const range = jalaliRangeToTehranClosed(fromJalali!.trim(), toJalali!.trim());
      if (!range) {
        throw new BadRequestException(
          'Invalid Jalali date range. Use YYYY/MM/DD and from <= to',
        );
      }
      where.occurredAt = { gte: range.start, lte: range.endInclusive };
    }

    const [rows, total, sumAgg] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: { category: { select: { name: true, code: true } } },
        orderBy: { occurredAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    return {
      data: rows.map((tx) => ({
        id: tx.id,
        occurredAt: tx.occurredAt.toISOString(),
        amountRial: tx.amount.toString(),
        description: tx.description,
        categoryName: tx.category?.name ?? null,
        categoryCode: tx.category?.code ?? null,
        sourceType: tx.sourceType,
        sourceId: tx.sourceId,
      })),
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit) || 0,
      totalAmountRial: (sumAgg._sum.amount ?? 0n).toString(),
    };
  }
}
