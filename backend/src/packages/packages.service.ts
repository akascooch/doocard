import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerPackageStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parsePositiveRial } from '../packages/packages.constants';
import {
  AssignPackageDto,
  ConsumePackageDto,
  CreatePackageTemplateDto,
  UpdatePackageTemplateDto,
} from './dto/packages.dto';

type TemplateRow = {
  id: string;
  title: string;
  description: string | null;
  priceRial: bigint;
  validityDays: number;
  totalSessions: number;
  serviceId: number | null;
  pointsRequired: number | null;
  isActive: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  service?: { id: number; name: string } | null;
  templateServices?: Array<{ serviceId: number; service?: { id: number; name: string } | null }>;
};

function templateServiceIds(row: TemplateRow): number[] {
  const fromLinks = (row.templateServices || [])
    .map((link) => link.serviceId)
    .filter((id) => Number.isInteger(id) && id > 0);
  if (fromLinks.length > 0) return [...new Set(fromLinks)];
  if (row.serviceId) return [row.serviceId];
  return [];
}

function serializeTemplate(row: TemplateRow) {
  const serviceIds = templateServiceIds(row);
  const serviceNames =
    row.templateServices
      ?.map((link) => link.service?.name)
      .filter((name): name is string => Boolean(name)) ?? [];
  if (serviceNames.length === 0 && row.service?.name) {
    serviceNames.push(row.service.name);
  }
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priceRial: row.priceRial.toString(),
    validityDays: row.validityDays,
    totalSessions: row.totalSessions,
    unlimited: row.totalSessions === 0,
    serviceId: serviceIds[0] ?? row.serviceId ?? null,
    serviceIds,
    serviceName: serviceNames[0] ?? row.service?.name ?? null,
    serviceNames,
    pointsRequired: row.pointsRequired,
    isActive: row.isActive,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeOwned(row: {
  id: string;
  customerId: number;
  packageTemplateId: string;
  totalSessions: number;
  remainingSessions: number;
  expiresAt: Date;
  status: CustomerPackageStatus;
  paymentMethod: string;
  notes: string | null;
  createdAt: Date;
  template?: TemplateRow | null;
}) {
  const serviceIds = row.template ? templateServiceIds(row.template) : [];
  return {
    id: row.id,
    customerId: row.customerId,
    packageTemplateId: row.packageTemplateId,
    title: row.template?.title ?? null,
    serviceName: row.template?.service?.name ?? row.template?.templateServices?.[0]?.service?.name ?? null,
    serviceNames:
      row.template?.templateServices
        ?.map((link) => link.service?.name)
        .filter((name): name is string => Boolean(name)) ?? [],
    serviceId: serviceIds[0] ?? row.template?.serviceId ?? null,
    serviceIds,
    totalSessions: row.totalSessions,
    remainingSessions: row.remainingSessions,
    unlimited: row.totalSessions === 0,
    expiresAt: row.expiresAt,
    status: row.status,
    paymentMethod: row.paymentMethod,
    notes: row.notes,
    createdAt: row.createdAt,
    expiringSoon:
      row.status === 'ACTIVE' && row.expiresAt.getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000,
  };
}

const TEMPLATE_INCLUDE = {
  service: { select: { id: true, name: true } },
  templateServices: { include: { service: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class PackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listTemplates() {
    const rows = await this.prisma.servicePackageTemplate.findMany({
      include: TEMPLATE_INCLUDE,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    return { items: rows.map(serializeTemplate) };
  }

  private resolveServiceIds(dto: { serviceIds?: number[]; serviceId?: number }): number[] {
    const ids = [...new Set([...(dto.serviceIds || []), ...(dto.serviceId ? [dto.serviceId] : [])])].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
    if (ids.length === 0) {
      throw new BadRequestException('حداقل یک خدمت برای پکیج لازم است');
    }
    return ids;
  }

  private async assertServicesExist(serviceIds: number[]) {
    const found = await this.prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true },
    });
    if (found.length !== serviceIds.length) {
      throw new NotFoundException('یک یا چند خدمت یافت نشد');
    }
  }

  async createTemplate(dto: CreatePackageTemplateDto) {
    const serviceIds = this.resolveServiceIds(dto);
    await this.assertServicesExist(serviceIds);
    let priceRial: bigint;
    try {
      priceRial = parsePositiveRial(dto.priceRial);
    } catch {
      throw new BadRequestException('قیمت باید عدد صحیح مثبت ریال باشد');
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.servicePackageTemplate.create({
        data: {
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          priceRial,
          validityDays: dto.validityDays,
          totalSessions: dto.totalSessions,
          serviceId: serviceIds[0],
          pointsRequired: null,
        },
      });
      await tx.servicePackageTemplateService.createMany({
        data: serviceIds.map((serviceId) => ({
          packageTemplateId: created.id,
          serviceId,
        })),
      });
      return tx.servicePackageTemplate.findUniqueOrThrow({
        where: { id: created.id },
        include: TEMPLATE_INCLUDE,
      });
    });
    return serializeTemplate(row);
  }

  async updateTemplate(id: string, dto: UpdatePackageTemplateDto) {
    const existing = await this.prisma.servicePackageTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('پکیج یافت نشد');
    let priceRial: bigint | undefined;
    if (dto.priceRial !== undefined) {
      try {
        priceRial = parsePositiveRial(dto.priceRial);
      } catch {
        throw new BadRequestException('قیمت باید عدد صحیح مثبت ریال باشد');
      }
    }
    const serviceIds =
      dto.serviceIds !== undefined || dto.serviceId !== undefined
        ? this.resolveServiceIds(dto)
        : null;
    if (serviceIds) await this.assertServicesExist(serviceIds);

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.servicePackageTemplate.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
          ...(priceRial !== undefined ? { priceRial } : {}),
          ...(dto.validityDays !== undefined ? { validityDays: dto.validityDays } : {}),
          ...(dto.totalSessions !== undefined ? { totalSessions: dto.totalSessions } : {}),
          ...(serviceIds ? { serviceId: serviceIds[0] } : {}),
          ...(dto.isActive !== undefined
            ? { isActive: dto.isActive, archivedAt: dto.isActive ? null : existing.archivedAt ?? new Date() }
            : {}),
        },
      });
      if (serviceIds) {
        await tx.servicePackageTemplateService.deleteMany({ where: { packageTemplateId: id } });
        await tx.servicePackageTemplateService.createMany({
          data: serviceIds.map((serviceId) => ({ packageTemplateId: id, serviceId })),
        });
      }
      return tx.servicePackageTemplate.findUniqueOrThrow({
        where: { id },
        include: TEMPLATE_INCLUDE,
      });
    });
    return serializeTemplate(row);
  }

  async deactivateTemplate(id: string) {
    const existing = await this.prisma.servicePackageTemplate.findUnique({
      where: { id },
      include: TEMPLATE_INCLUDE,
    });
    if (!existing) throw new NotFoundException('پکیج یافت نشد');
    const row = await this.prisma.servicePackageTemplate.update({
      where: { id },
      data: { isActive: false, archivedAt: existing.archivedAt ?? new Date() },
      include: TEMPLATE_INCLUDE,
    });
    return serializeTemplate(row);
  }

  async assignPackage(dto: AssignPackageDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException('مشتری یافت نشد');
    const template = await this.prisma.servicePackageTemplate.findFirst({
      where: { id: dto.packageTemplateId, isActive: true, archivedAt: null },
      include: TEMPLATE_INCLUDE,
    });
    if (!template) throw new NotFoundException('پکیج فعال یافت نشد');
    if (templateServiceIds(template).length === 0) {
      throw new BadRequestException('پکیج هیچ خدمتی ندارد');
    }

    const expiresAt = new Date(Date.now() + template.validityDays * 24 * 60 * 60 * 1000);
    return this.prisma.$transaction(async (tx) => {
      if (dto.paymentMethod === 'WALLET') {
        await this.debitWallet(tx, dto.customerId, template.priceRial, template.id);
      }
      const row = await tx.customerServicePackage.create({
        data: {
          customerId: dto.customerId,
          packageTemplateId: template.id,
          totalSessions: template.totalSessions,
          remainingSessions: template.totalSessions,
          expiresAt,
          status: CustomerPackageStatus.ACTIVE,
          paymentMethod: dto.paymentMethod,
          notes: dto.notes?.trim() || null,
        },
        include: { template: { include: TEMPLATE_INCLUDE } },
      });
      return serializeOwned(row);
    });
  }

  async consumePackageSession(
    customerPackageId: string,
    dto: ConsumePackageDto,
    actorUserId?: number | null,
  ) {
    return this.prisma.$transaction(async (tx) =>
      this.consumePackageSessionInTx(tx, customerPackageId, dto, actorUserId),
    );
  }

  async consumePackageSessionInTx(
    tx: Prisma.TransactionClient,
    customerPackageId: string,
    dto: ConsumePackageDto,
    actorUserId?: number | null,
  ) {
    const now = new Date();
    const owned = await tx.customerServicePackage.findUnique({
      where: { id: customerPackageId },
      include: { template: { include: TEMPLATE_INCLUDE } },
    });
    if (!owned) throw new NotFoundException('پکیج مشتری یافت نشد');
    if (owned.status === CustomerPackageStatus.CANCELLED) {
      throw new BadRequestException('این پکیج لغو شده است');
    }
    if (owned.expiresAt < now || owned.status === CustomerPackageStatus.EXPIRED) {
      if (owned.status === CustomerPackageStatus.ACTIVE) {
        await tx.customerServicePackage.update({
          where: { id: owned.id },
          data: { status: CustomerPackageStatus.EXPIRED },
        });
      }
      throw new BadRequestException('اعتبار پکیج به پایان رسیده است');
    }

    const appointment = await tx.appointment.findFirst({
      where: { id: dto.appointmentId, customerId: owned.customerId, deletedAt: null },
      include: { appointmentServices: true },
    });
    if (!appointment) throw new NotFoundException('نوبت این مشتری یافت نشد');

    const appointmentServiceIds = this.appointmentServiceIds(appointment);
    const packageServiceIds = new Set(templateServiceIds(owned.template as TemplateRow));
    const matchedServiceId =
      dto.serviceId && packageServiceIds.has(dto.serviceId) && appointmentServiceIds.includes(dto.serviceId)
        ? dto.serviceId
        : appointmentServiceIds.find((id) => packageServiceIds.has(id));
    if (!matchedServiceId) {
      throw new BadRequestException('این نوبت شامل خدمت پکیج نیست');
    }

    const unlimited = owned.totalSessions === 0;
    if (!unlimited) {
      const updated = await tx.customerServicePackage.updateMany({
        where: {
          id: owned.id,
          status: CustomerPackageStatus.ACTIVE,
          remainingSessions: { gt: 0 },
          expiresAt: { gte: now },
        },
        data: { remainingSessions: { decrement: 1 } },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('جلسهٔ قابل مصرف باقی نمانده است');
      }
    }

    try {
      await tx.customerPackageConsumption.create({
        data: {
          customerPackageId: owned.id,
          appointmentId: dto.appointmentId,
          serviceId: matchedServiceId,
          consumedByUserId: actorUserId ?? null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('برای این نوبت و خدمت قبلاً جلسه مصرف شده است');
      }
      throw error;
    }

    if (!unlimited) {
      const after = await tx.customerServicePackage.findUnique({ where: { id: owned.id } });
      if (after && after.remainingSessions <= 0) {
        await tx.customerServicePackage.update({
          where: { id: owned.id },
          data: { status: CustomerPackageStatus.EXHAUSTED, remainingSessions: 0 },
        });
      }
    }

    const fresh = await tx.customerServicePackage.findUnique({
      where: { id: owned.id },
      include: { template: { include: TEMPLATE_INCLUDE } },
    });
    return serializeOwned(fresh!);
  }

  async myPackages(userId: number) {
    const customer = await this.requireCustomer(userId);
    await this.expireOverdue(customer.id);
    const rows = await this.prisma.customerServicePackage.findMany({
      where: { customerId: customer.id },
      include: { template: { include: TEMPLATE_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });
    return { items: rows.map(serializeOwned) };
  }

  async listCustomerPackages(
    customerId: number,
    actor?: { id?: number; sub?: number; role?: string },
  ) {
    if (actor?.role === UserRole.EMPLOYEE || actor?.role === UserRole.SERVICE) {
      await this.assertStaffCanSeeCustomer(actor, customerId);
    }
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('مشتری یافت نشد');
    await this.expireOverdue(customerId);
    const rows = await this.prisma.customerServicePackage.findMany({
      where: { customerId },
      include: { template: { include: TEMPLATE_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });
    return { items: rows.map(serializeOwned) };
  }

  async listConsumptionHistory(customerId: number, customerPackageId?: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('مشتری یافت نشد');
    const rows = await this.prisma.customerPackageConsumption.findMany({
      where: {
        customerPackage: {
          customerId,
          ...(customerPackageId ? { id: customerPackageId } : {}),
        },
      },
      include: {
        service: { select: { id: true, name: true } },
        appointment: { select: { id: true, scheduledAt: true, status: true } },
        customerPackage: {
          select: {
            id: true,
            packageTemplateId: true,
            totalSessions: true,
            remainingSessions: true,
            template: { select: { title: true } },
          },
        },
        consumedByUser: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return {
      customerId,
      items: rows.map((row) => ({
        id: row.id,
        customerPackageId: row.customerPackageId,
        packageTitle: row.customerPackage.template?.title ?? null,
        appointmentId: row.appointmentId,
        appointmentScheduledAt: row.appointment.scheduledAt,
        appointmentStatus: row.appointment.status,
        serviceId: row.serviceId,
        serviceName: row.service?.name ?? null,
        consumedAt: row.createdAt,
        consumedByUserId: row.consumedByUserId,
        consumedByName: row.consumedByUser?.name ?? null,
        remainingSessions: row.customerPackage.remainingSessions,
        totalSessions: row.customerPackage.totalSessions,
        unlimited: row.customerPackage.totalSessions === 0,
      })),
    };
  }

  async eligibleForAppointment(appointmentId: number) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, deletedAt: null },
      include: { appointmentServices: true },
    });
    if (!appointment) throw new NotFoundException('نوبت یافت نشد');
    const serviceIds = this.appointmentServiceIds(appointment);
    const items = await this.activeMatchingPackages(appointment.customerId, serviceIds);
    return { appointmentId, customerId: appointment.customerId, items };
  }

  async eligibleForAppointments(appointmentIds: number[]) {
    const unique = [...new Set(appointmentIds.filter((id) => Number.isInteger(id) && id > 0))].slice(0, 40);
    if (unique.length === 0) return { byAppointmentId: {} as Record<string, ReturnType<typeof serializeOwned>[]> };
    const appointments = await this.prisma.appointment.findMany({
      where: { id: { in: unique }, deletedAt: null },
      include: { appointmentServices: true },
    });
    const customerIds = [...new Set(appointments.map((row) => row.customerId))];
    for (const customerId of customerIds) {
      await this.expireOverdue(customerId);
    }
    const packages =
      customerIds.length === 0
        ? []
        : await this.prisma.customerServicePackage.findMany({
            where: {
              customerId: { in: customerIds },
              status: CustomerPackageStatus.ACTIVE,
              expiresAt: { gte: new Date() },
              OR: [{ totalSessions: 0 }, { remainingSessions: { gt: 0 } }],
            },
            include: { template: { include: TEMPLATE_INCLUDE } },
          });
    const byAppointmentId: Record<string, ReturnType<typeof serializeOwned>[]> = {};
    for (const appointment of appointments) {
      const serviceIds = new Set(this.appointmentServiceIds(appointment));
      byAppointmentId[String(appointment.id)] = packages
        .filter((row) => {
          if (row.customerId !== appointment.customerId) return false;
          const pkgServices = templateServiceIds(row.template as TemplateRow);
          return pkgServices.some((id) => serviceIds.has(id));
        })
        .map(serializeOwned);
    }
    return { byAppointmentId };
  }

  /** Prefer appointment_services, then FK serviceId, then JSON services snapshot (online booking). */
  appointmentServiceIds(appointment: {
    serviceId?: number | null;
    appointmentServices?: { serviceId: number }[];
    services?: unknown;
  }) {
    const ids = new Set<number>();
    if (appointment.serviceId) ids.add(appointment.serviceId);
    for (const row of appointment.appointmentServices || []) ids.add(row.serviceId);
    if (Array.isArray(appointment.services)) {
      for (const snap of appointment.services as Array<{ serviceId?: number }>) {
        const sid = Number(snap?.serviceId);
        if (Number.isInteger(sid) && sid > 0) ids.add(sid);
      }
    }
    return [...ids];
  }

  private async activeMatchingPackages(customerId: number, serviceIds: number[]) {
    await this.expireOverdue(customerId);
    if (serviceIds.length === 0) return [];
    const rows = await this.prisma.customerServicePackage.findMany({
      where: {
        customerId,
        status: CustomerPackageStatus.ACTIVE,
        expiresAt: { gte: new Date() },
        OR: [{ totalSessions: 0 }, { remainingSessions: { gt: 0 } }],
      },
      include: { template: { include: TEMPLATE_INCLUDE } },
      orderBy: { expiresAt: 'asc' },
    });
    const wanted = new Set(serviceIds);
    return rows
      .filter((row) => templateServiceIds(row.template as TemplateRow).some((id) => wanted.has(id)))
      .map(serializeOwned);
  }

  async loyaltyEligibleForCustomer(customerId: number) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('مشتری یافت نشد');
    return { customerId, points: 0, items: [] as ReturnType<typeof serializeTemplate>[] };
  }

  /**
   * Same visibility as GET /customers:
   * EMPLOYEE sees preferred customers only.
   * SERVICE sees preferred customers or customers they have a non-deleted appointment with.
   */
  private staffCustomerWhere(role: string, employeeId: number): Prisma.CustomerWhereInput {
    if (role === UserRole.EMPLOYEE) {
      return { preferredEmployeeId: employeeId };
    }
    if (role === UserRole.SERVICE) {
      return {
        OR: [
          { preferredEmployeeId: employeeId },
          { appointments: { some: { employeeId, deletedAt: null } } },
        ],
      };
    }
    throw new ForbiddenException('دسترسی به پکیج مشتریان برای این نقش مجاز نیست');
  }

  private async requireVisibleStaff(actor?: { id?: number; sub?: number; role?: string }) {
    const role = actor?.role;
    if (role !== UserRole.EMPLOYEE && role !== UserRole.SERVICE) {
      throw new ForbiddenException('دسترسی به پکیج مشتریان برای این نقش مجاز نیست');
    }
    const userId = Number(actor?.id ?? actor?.sub);
    if (!Number.isInteger(userId) || userId < 1) {
      throw new ForbiddenException('کاربر احراز هویت نشده است');
    }
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee || !employee.isActive) {
      throw new ForbiddenException('پروفایل کارمند فعال یافت نشد');
    }
    return { role, employeeId: employee.id };
  }

  private async assertStaffCanSeeCustomer(
    actor: { id?: number; sub?: number; role?: string },
    customerId: number,
  ) {
    const staff = await this.requireVisibleStaff(actor);
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, ...this.staffCustomerWhere(staff.role, staff.employeeId) },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('مشتری یافت نشد');
    return staff;
  }

  async listVisibleActiveHolders(
    actor: { id?: number; sub?: number; role?: string },
    page = 1,
    pageSize = 20,
  ) {
    const staff = await this.requireVisibleStaff(actor);
    const size = Math.min(Math.max(pageSize, 1), 50);
    const current = Math.max(page, 1);
    const now = new Date();
    const activePackage: Prisma.CustomerServicePackageWhereInput = {
      status: CustomerPackageStatus.ACTIVE,
      expiresAt: { gte: now },
      OR: [{ totalSessions: 0 }, { remainingSessions: { gt: 0 } }],
    };
    const where: Prisma.CustomerWhereInput = {
      ...this.staffCustomerWhere(staff.role, staff.employeeId),
      servicePackages: { some: activePackage },
    };
    const [total, rows] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        include: {
          user: { select: { name: true, phone: true } },
          servicePackages: {
            where: activePackage,
            include: { template: { include: TEMPLATE_INCLUDE } },
            orderBy: { expiresAt: 'asc' },
          },
        },
        orderBy: { id: 'asc' },
        skip: (current - 1) * size,
        take: size,
      }),
    ]);
    return {
      page: current,
      pageSize: size,
      total,
      items: rows.map((customer) => ({
        customerId: customer.id,
        name: customer.user?.name ?? null,
        phone: customer.user?.phone ?? null,
        packages: customer.servicePackages.map(serializeOwned),
      })),
    };
  }

  async listVisiblePackageHistory(
    actor: { id?: number; sub?: number; role?: string },
    customerId: number,
  ) {
    await this.assertStaffCanSeeCustomer(actor, customerId);
    const rows = await this.prisma.customerPackageConsumption.findMany({
      where: {
        customerPackage: { customerId },
        appointment: { deletedAt: null, status: { not: 'CANCELLED' } },
      },
      include: {
        service: { select: { id: true, name: true } },
        appointment: { select: { id: true, scheduledAt: true, status: true, deletedAt: true } },
        customerPackage: {
          select: {
            id: true,
            totalSessions: true,
            remainingSessions: true,
            template: { select: { title: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      customerId,
      items: rows.map((row) => ({
        id: row.id,
        customerPackageId: row.customerPackageId,
        packageTitle: row.customerPackage.template?.title ?? null,
        appointmentId: row.appointmentId,
        appointmentScheduledAt: row.appointment.scheduledAt,
        appointmentStatus: row.appointment.status,
        serviceId: row.serviceId,
        serviceName: row.service?.name ?? null,
        consumedAt: row.createdAt,
        totalSessions: row.customerPackage.totalSessions,
        remainingSessions: row.customerPackage.remainingSessions,
        unlimited: row.customerPackage.totalSessions === 0,
      })),
    };
  }

  private async expireOverdue(customerId: number) {
    await this.prisma.customerServicePackage.updateMany({
      where: { customerId, status: CustomerPackageStatus.ACTIVE, expiresAt: { lt: new Date() } },
      data: { status: CustomerPackageStatus.EXPIRED },
    });
  }

  private async requireCustomer(userId: number) {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new NotFoundException('پروفایل مشتری یافت نشد');
    return customer;
  }

  private async debitWallet(
    tx: Prisma.TransactionClient,
    customerId: number,
    amount: bigint,
    referenceId: string,
  ) {
    const sum = await tx.customerWalletLedger.aggregate({
      where: { customerId },
      _sum: { amount: true },
    });
    const balance = sum._sum.amount ?? 0n;
    if (balance < amount) {
      throw new BadRequestException('موجودی کیف پول کافی نیست');
    }
    await tx.customerWalletLedger.create({
      data: {
        customerId,
        amount: -amount,
        type: 'DEBIT',
        source: 'PACKAGE_PURCHASE',
        referenceId,
      },
    });
  }
}
