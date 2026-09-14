import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerPackageStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  LOYALTY_MIN_REDEEM_POINTS,
  LOYALTY_RIALS_PER_POINT,
  parsePositiveRial,
} from '../packages/packages.constants';
import { AssignPackageDto, ConsumePackageDto, CreatePackageTemplateDto, UpdatePackageTemplateDto } from './dto/packages.dto';

function serializeTemplate(row: {
  id: string;
  title: string;
  description: string | null;
  priceRial: bigint;
  validityDays: number;
  totalSessions: number;
  serviceId: number;
  isActive: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  service?: { id: number; name: string } | null;
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priceRial: row.priceRial.toString(),
    validityDays: row.validityDays,
    totalSessions: row.totalSessions,
    serviceId: row.serviceId,
    serviceName: row.service?.name ?? null,
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
  template?: { title: string; serviceId?: number; service?: { name: string } | null } | null;
}) {
  return {
    id: row.id,
    customerId: row.customerId,
    packageTemplateId: row.packageTemplateId,
    title: row.template?.title ?? null,
    serviceName: row.template?.service?.name ?? null,
    serviceId: row.template?.serviceId ?? null,
    totalSessions: row.totalSessions,
    remainingSessions: row.remainingSessions,
    expiresAt: row.expiresAt,
    status: row.status,
    paymentMethod: row.paymentMethod,
    notes: row.notes,
    createdAt: row.createdAt,
    expiringSoon: row.status === 'ACTIVE' && row.expiresAt.getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000,
  };
}

@Injectable()
export class PackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listTemplates() {
    const rows = await this.prisma.servicePackageTemplate.findMany({
      include: { service: { select: { id: true, name: true } } },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    return { items: rows.map(serializeTemplate) };
  }

  async createTemplate(dto: CreatePackageTemplateDto) {
    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service) throw new NotFoundException('خدمت یافت نشد');
    let priceRial: bigint;
    try {
      priceRial = parsePositiveRial(dto.priceRial);
    } catch {
      throw new BadRequestException('قیمت باید عدد صحیح مثبت ریال باشد');
    }
    const row = await this.prisma.servicePackageTemplate.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        priceRial,
        validityDays: dto.validityDays,
        totalSessions: dto.totalSessions,
        serviceId: dto.serviceId,
      },
      include: { service: { select: { id: true, name: true } } },
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
    if (dto.serviceId) {
      const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
      if (!service) throw new NotFoundException('خدمت یافت نشد');
    }
    const row = await this.prisma.servicePackageTemplate.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(priceRial !== undefined ? { priceRial } : {}),
        ...(dto.validityDays !== undefined ? { validityDays: dto.validityDays } : {}),
        ...(dto.totalSessions !== undefined ? { totalSessions: dto.totalSessions } : {}),
        ...(dto.serviceId !== undefined ? { serviceId: dto.serviceId } : {}),
        ...(dto.isActive !== undefined
          ? { isActive: dto.isActive, archivedAt: dto.isActive ? null : existing.archivedAt ?? new Date() }
          : {}),
      },
      include: { service: { select: { id: true, name: true } } },
    });
    return serializeTemplate(row);
  }

  async deactivateTemplate(id: string) {
    const existing = await this.prisma.servicePackageTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('پکیج یافت نشد');
    const row = await this.prisma.servicePackageTemplate.update({
      where: { id },
      data: { isActive: false, archivedAt: existing.archivedAt ?? new Date() },
    });
    return serializeTemplate(row);
  }

  async assignPackage(dto: AssignPackageDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException('مشتری یافت نشد');
    const template = await this.prisma.servicePackageTemplate.findFirst({
      where: { id: dto.packageTemplateId, isActive: true, archivedAt: null },
    });
    if (!template) throw new NotFoundException('پکیج فعال یافت نشد');

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
        include: { template: { include: { service: { select: { name: true } } } } },
      });
      return serializeOwned(row);
    });
  }

  async consumePackageSession(customerPackageId: string, dto: ConsumePackageDto) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const owned = await tx.customerServicePackage.findUnique({
        where: { id: customerPackageId },
        include: { template: true },
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
      const serviceOk =
        appointment.serviceId === owned.template.serviceId ||
        appointment.appointmentServices.some((item) => item.serviceId === owned.template.serviceId);
      if (!serviceOk) {
        throw new BadRequestException('این نوبت شامل خدمت پکیج نیست');
      }

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

      try {
        await tx.customerPackageConsumption.create({
          data: { customerPackageId: owned.id, appointmentId: dto.appointmentId },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new BadRequestException('برای این نوبت قبلاً جلسه مصرف شده است');
        }
        throw error;
      }

      const after = await tx.customerServicePackage.findUnique({ where: { id: owned.id } });
      if (after && after.remainingSessions <= 0) {
        await tx.customerServicePackage.update({
          where: { id: owned.id },
          data: { status: CustomerPackageStatus.EXHAUSTED, remainingSessions: 0 },
        });
      }
      const fresh = await tx.customerServicePackage.findUnique({
        where: { id: owned.id },
        include: { template: { include: { service: { select: { name: true } } } } },
      });
      return serializeOwned(fresh!);
    });
  }

  async myPackages(userId: number) {
    const customer = await this.requireCustomer(userId);
    await this.expireOverdue(customer.id);
    const rows = await this.prisma.customerServicePackage.findMany({
      where: { customerId: customer.id },
      include: { template: { include: { service: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return { items: rows.map(serializeOwned) };
  }

  async listCustomerPackages(customerId: number) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('مشتری یافت نشد');
    await this.expireOverdue(customerId);
    const rows = await this.prisma.customerServicePackage.findMany({
      where: { customerId },
      include: { template: { include: { service: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return { items: rows.map(serializeOwned) };
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
              remainingSessions: { gt: 0 },
              expiresAt: { gte: new Date() },
            },
            include: { template: { include: { service: { select: { name: true } } } } },
          });
    const byAppointmentId: Record<string, ReturnType<typeof serializeOwned>[]> = {};
    for (const appointment of appointments) {
      const serviceIds = new Set(this.appointmentServiceIds(appointment));
      byAppointmentId[String(appointment.id)] = packages
        .filter(
          (row) =>
            row.customerId === appointment.customerId && serviceIds.has(row.template.serviceId),
        )
        .map(serializeOwned);
    }
    return { byAppointmentId };
  }

  private appointmentServiceIds(appointment: {
    serviceId: number | null;
    appointmentServices: { serviceId: number }[];
  }) {
    const ids = new Set<number>();
    if (appointment.serviceId) ids.add(appointment.serviceId);
    for (const row of appointment.appointmentServices) ids.add(row.serviceId);
    return [...ids];
  }

  private async activeMatchingPackages(customerId: number, serviceIds: number[]) {
    await this.expireOverdue(customerId);
    if (serviceIds.length === 0) return [];
    const rows = await this.prisma.customerServicePackage.findMany({
      where: {
        customerId,
        status: CustomerPackageStatus.ACTIVE,
        remainingSessions: { gt: 0 },
        expiresAt: { gte: new Date() },
        template: { serviceId: { in: serviceIds } },
      },
      include: { template: { include: { service: { select: { name: true } } } } },
      orderBy: { expiresAt: 'asc' },
    });
    return rows.map(serializeOwned);
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
