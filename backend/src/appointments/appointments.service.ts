import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException, Inject, forwardRef, Optional } from '@nestjs/common';
import { NotificationType, Prisma, InventoryMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  SettleAppointmentDto,
  SettleProductItemDto,
  TipRecipientType,
  GetSlotsDto,
  QueryAppointmentsDto,
} from './dto';
import {
  TIP_PERSONAL_RECIPIENT_PERCENT,
  TIP_TEAM_BARBER_PERCENT,
  TIP_TEAM_SERVICE_POOL_PERCENT,
} from '../common/constants/tip-distribution.constants';
import {
  computePersonalTipAllocations,
  computeTeamTipAllocations,
} from '../accounting/ledger-backfill.match';
import { BARBER_APPOINTMENT_DEDUCTION_RIAL } from '../common/constants/employee-commission.constants';

import { AccountingService } from '../accounting/accounting.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { CalendarService } from '../calendar/calendar.service';
import { tehranIsoFromUtcMidnightAndTime } from '../calendar/tehran-civil-datetime.util';
import {
  normalizeBookingClockTime,
  SLOT_INTERVAL_MIN,
  SLOT_TIME_INSTRUCTION_FA,
} from './slot-time.util';
import { SmsOutboundService } from '../sms/sms-outbound.service';
import { SmsTemplateService } from '../sms/sms-template.service';
import { TipAlertService } from '../sms/tip-alert.service';
import { SMS_TEMPLATE_KEYS } from '../sms/sms-template.catalog';
import {
  formatFaAmount,
  formatBarberSettlementMessage,
  resolveSettlementToman,
  settlementBarberNotifyKeys,
} from './settlement-notify.util';
import { normalizeAppointmentFields } from '../common/utils/appointment-response.util';
import { buildAppointmentTipDescription } from '../common/utils/tip-ledger-description';
import {
  APPOINTMENT_NOT_FOUND_FA,
  EMPLOYEE_PROFILE_MISSING_FA,
  actorUserId,
  assertCustomerOwnsAppointment,
  assertEmployeeNotImpersonating,
  assertEmployeeOwnsAppointment,
  isCustomerRole,
  isEmployeeRole,
  scopedEmployeeListId,
} from './appointment-access.util';
import { StockNotificationService } from '../waitlist/stock-notification.service';

export interface ServiceSnapshot {
  serviceId: number;
  priceAtBooking: number; // RIAL
  durationMin: number;
  serviceName?: string;
}

/** Slot grid and booking window (Asia/Tehran business hours). */
const BOOKING_DURATION_MIN = 60;
const BUSINESS_HOUR_START = 10;
const BUSINESS_HOUR_END = 22;

function computeTipShares(tipRial: bigint): { staffShare: bigint; salonShare: bigint } {
  // Personal tips: 100% staff, 0% salon. Team shares are computed separately.
  void TIP_PERSONAL_RECIPIENT_PERCENT;
  void TIP_TEAM_BARBER_PERCENT;
  void TIP_TEAM_SERVICE_POOL_PERCENT;
  return { staffShare: tipRial, salonShare: 0n };
}

/** Public user fields only — never expose password or tokens in appointment responses. */
const APPOINTMENT_USER_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  role: true,
} as const;

/** Standard relations for appointment list/detail API responses. */
const APPOINTMENT_DETAIL_INCLUDE = {
  customer: { include: { user: { select: APPOINTMENT_USER_SELECT } } },
  employee: { include: { user: { select: APPOINTMENT_USER_SELECT } } },
  tipRecipientEmployee: { include: { user: { select: APPOINTMENT_USER_SELECT } } },
  service: true,
  paidByUser: { select: { id: true, name: true } },
  calendarDate: true,
} as const;

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => AccountingService))
    private accountingService: AccountingService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
    private pushNotificationsService: PushNotificationsService,
    private calendarService: CalendarService,
    private smsOutbound: SmsOutboundService,
    private smsTemplates: SmsTemplateService,
    private tipAlertService: TipAlertService,
    @Optional() private readonly stockNotifications?: StockNotificationService,
  ) {}

  private async requireEmployeeActor(currentUser: any) {
    const userId = actorUserId(currentUser);
    if (!userId) {
      throw new ForbiddenException(EMPLOYEE_PROFILE_MISSING_FA);
    }
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      throw new ForbiddenException(EMPLOYEE_PROFILE_MISSING_FA);
    }
    return employee;
  }

  private async assertAppointmentReadAccess(
    appointment: { employeeId?: number | null; customerId?: number | null },
    currentUser?: any,
  ) {
    if (isEmployeeRole(currentUser)) {
      const employee = await this.requireEmployeeActor(currentUser);
      assertEmployeeOwnsAppointment(employee.id, appointment.employeeId ?? null);
      return;
    }
    if (isCustomerRole(currentUser)) {
      const userId = actorUserId(currentUser);
      if (!userId) {
        throw new ForbiddenException('Customer profile not found');
      }
      const customer = await this.prisma.customer.findUnique({
        where: { userId },
      });
      if (!customer) {
        throw new ForbiddenException('Customer profile not found');
      }
      assertCustomerOwnsAppointment(customer.id, appointment.customerId ?? null);
    }
  }

  /**
   * Policy-gated, deduped appointment SMS via SmsOutboundService.
   * Soft-fail; never throws into booking flows.
   */
  private async sendPolicySms(
    eventKey: string,
    phone: string,
    message: string,
    dedupeKey: string,
    appointmentId?: number,
    templateKey?: string,
  ): Promise<{ success: boolean; skipped?: boolean; reason?: string }> {
    try {
      return await this.smsOutbound.sendIfAllowed({
        eventKey,
        phone,
        message,
        dedupeKey,
        appointmentId,
        templateKey,
      });
    } catch (e: any) {
      return { success: false, reason: e?.message || 'sms error' };
    }
  }

  /**
   * Run SMS after the HTTP response path continues. Never rejects into callers.
   * Deduped SmsOutboundService still records smsEvent; failures are logged only.
   */
  private enqueueAppointmentSms(label: string, work: () => Promise<void>) {
    void Promise.resolve()
      .then(work)
      .catch((e: any) => {
        console.warn(`[SMS] ${label} failed after enqueue:`, e?.message || e);
      });
  }

  /**
   * Shared helper: get "now" in UTC plus Tehran date/time strings.
   * Ensures getAvailableSlots and getEarliestAvailableSlot use the same time base.
   */
  private getTehranNow() {
    const nowUtc = new Date();

    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tehran',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const dateStr = dateFormatter.format(nowUtc); // YYYY-MM-DD in Tehran
    const timeStr = timeFormatter.format(nowUtc); // HH:mm:ss in Tehran

    return { nowUtc, dateStr, timeStr };
  }

  /** Half-open interval overlap: [startA, endA) vs [startB, endB). */
  private intervalsOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
    return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
  }

  private clampBusinessHours(
    windows: { start: number; end: number }[],
  ): { start: number; end: number }[] {
    return windows
      .map((w) => ({
        start: Math.max(BUSINESS_HOUR_START, w.start),
        end: Math.min(BUSINESS_HOUR_END, w.end),
      }))
      .filter((w) => w.start < w.end);
  }

  /**
   * Reserve slot with PostgreSQL advisory lock (concurrent-safe)
   * Creates appointment with atomic slot reservation
   */
  async create(dto: CreateAppointmentDto, currentUser?: any) {

    if (isEmployeeRole(currentUser)) {
      const actorEmployee = await this.requireEmployeeActor(currentUser);
      assertEmployeeNotImpersonating(dto.employeeId, actorEmployee.id);
      dto.employeeId = actorEmployee.id;
    }

    const clientOpId = dto.clientOpId?.trim();
    if (clientOpId) {
      const existing = await this.prisma.appointment.findUnique({
        where: { clientOpId },
        include: APPOINTMENT_DETAIL_INCLUDE,
      });
      if (existing) {
        await this.assertAppointmentReadAccess(existing, currentUser);
        return this.formatAppointment(existing);
      }
    }

    // Parse date input (jalaliDate + time OR scheduledAt)
    let scheduledAt: Date;
    let calendarDateId: number | undefined;

    if (dto.jalaliDate && dto.time) {
      // Parse Jalali date + time (Iran timezone: UTC+3:30)
      const clock = normalizeBookingClockTime(dto.time);
      if (!clock) {
        throw new BadRequestException(SLOT_TIME_INSTRUCTION_FA);
      }
      const gregorianDate = this.calendarService.toGregorian(dto.jalaliDate);
      
      let isoWithTZ: string;
      try {
        isoWithTZ = tehranIsoFromUtcMidnightAndTime(gregorianDate, clock);
      } catch {
        throw new BadRequestException('زمان نوبت نامعتبر است');
      }
      scheduledAt = new Date(isoWithTZ);

      // Get calendar_date_id
      const calendarDate = await this.calendarService.ensureExists({ jalaliDate: dto.jalaliDate });
      calendarDateId = calendarDate.id;
      
    } else if (dto.scheduledAt) {
      // Parse ISO date-time
      scheduledAt = new Date(dto.scheduledAt);
      
      // Extract date and get calendar_date_id
      const gregorianDate = new Date(Date.UTC(
        scheduledAt.getUTCFullYear(),
        scheduledAt.getUTCMonth(),
        scheduledAt.getUTCDate(),
        0, 0, 0, 0
      ));
      
      const calendarDate = await this.calendarService.ensureExists({ gregorianDate });
      calendarDateId = calendarDate.id;
      
    } else {
      throw new BadRequestException('Either (jalaliDate + time) or scheduledAt must be provided');
    }

    // Min 2h lead time (UTC comparison against Asia/Tehran "now").
    const nowUtc = new Date();
    const isStaff = currentUser?.role === 'ADMIN' || currentUser?.role === 'EMPLOYEE';

    // Customer / unauthenticated bookings require a 2-hour minimum lead time
    // in Asia/Tehran (UTC comparison). Staff (ADMIN / EMPLOYEE) may book desk
    // appointments without this window, including same-day back-office entries.
    if (!isStaff) {
      const minAllowedAtUtc = new Date(nowUtc.getTime() + 2 * 60 * 60 * 1000);
      if (scheduledAt < minAllowedAtUtc) {
        throw new BadRequestException(
          'زمان رزرو باید حداقل ۲ ساعت از زمان فعلی جلوتر باشد',
        );
      }
    }

    // Validate customer
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      include: { user: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${dto.customerId} not found`);
    }

    // Validate employee
    if (dto.employeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: dto.employeeId },
        include: {
          user: true,
          employeeServices: { include: { service: true } },
        },
      });

      if (!employee) {
        throw new NotFoundException(`Employee with ID ${dto.employeeId} not found`);
      }

      if (!employee.isActive || employee.user?.role !== 'EMPLOYEE') {
        throw new BadRequestException('این آرایشگر برای رزرو در دسترس نیست');
      }

      // Check if employee can perform at least one service
      const employeeServiceIds = employee.employeeServices.map(es => es.serviceId);
      const requestedServiceIds = dto.services.map(s => s.serviceId);
      const hasMatchingService = requestedServiceIds.some(sid => employeeServiceIds.includes(sid));

      if (!hasMatchingService) {
        throw new BadRequestException(
          `این آرایشگر هیچ یک از سرویس‌های انتخاب شده را ارائه نمی‌دهد`
        );
      }
    }

    // Build services snapshot and compute duration
    const servicesSnapshot: ServiceSnapshot[] = [];
    let totalDuration = 0;

    for (const serviceDto of dto.services) {
      const service = await this.prisma.service.findUnique({
        where: { id: serviceDto.serviceId },
      });

      if (!service) {
        throw new NotFoundException(`Service with ID ${serviceDto.serviceId} not found`);
      }

      const priceAtBooking = serviceDto.priceAtBooking !== undefined 
        ? serviceDto.priceAtBooking 
        : Math.floor(service.price * 10);

      const durationMin = serviceDto.durationMin !== undefined
        ? serviceDto.durationMin
        : service.durationMinutes;

      servicesSnapshot.push({
        serviceId: service.id,
        priceAtBooking,
        durationMin,
        serviceName: service.name,
      });

      totalDuration += durationMin;
    }

    const finalDuration = dto.durationMin || totalDuration;
    
    const endAt = new Date(scheduledAt.getTime() + finalDuration * 60 * 1000);

    // ATOMIC RESERVATION with PostgreSQL advisory lock
    // Keep only DB lock + conflict checks + insert inside the TX.
    // Notify/SMS/push MUST run after commit — otherwise default 5s interactive
    // timeout expires (Prisma P2028) when SMS HTTP (up to 10s×2) runs inside the TX.
    const appointment = await this.prisma.$transaction(
      async (tx) => {
        if (dto.employeeId) {
          // Acquire advisory lock for this employee (concurrent-safe)
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(CONCAT('employee:', ${dto.employeeId}::text)))`;


          // Check for overlapping appointments
          const overlapping = await tx.appointment.findFirst({
            where: {
              employeeId: dto.employeeId,
              status: { notIn: ['CANCELLED'] },
              deletedAt: null,
              OR: [
                {
                  AND: [
                    { scheduledAt: { lte: scheduledAt } },
                    { scheduledAt: { gte: new Date(scheduledAt.getTime() - finalDuration * 60 * 1000) } },
                  ],
                },
                {
                  AND: [
                    { scheduledAt: { gte: scheduledAt } },
                    { scheduledAt: { lt: endAt } },
                  ],
                },
              ],
            },
          });

          if (overlapping) {
            // Double-check with exact overlap calculation
            const overlappingEnd = new Date(
              overlapping.scheduledAt.getTime() + overlapping.durationMin * 60 * 1000
            );

            const hasConflict = this.intervalsOverlap(
              scheduledAt,
              endAt,
              overlapping.scheduledAt,
              overlappingEnd,
            );

            if (hasConflict) {
              throw new BadRequestException({
                statusCode: 409,
                message: 'تداخل زمانی! این زمان دیگر رزرو شده است',
                error: 'SLOT_CONFLICT',
                internalCode: 'SLOT_CONFLICT',
              });
            }
          }

          // Check for blocked times
          const blockedTime = await tx.blockedTime.findFirst({
            where: {
              employeeId: dto.employeeId,
              OR: [
                {
                  AND: [
                    { startAt: { lte: scheduledAt } },
                    { endAt: { gt: scheduledAt } },
                  ],
                },
                {
                  AND: [
                    { startAt: { lt: endAt } },
                    { endAt: { gte: endAt } },
                  ],
                },
              ],
            },
          });

          if (blockedTime) {
            throw new BadRequestException(
              `این زمان مسدود شده است. دلیل: ${blockedTime.reason || 'نامشخص'}`
            );
          }
        }

        // Determine initial status based on user role
        let initialStatus: 'PENDING' | 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'SETTLED' | 'PAID' | 'CANCELLED' = 'PENDING';
        if (currentUser?.role === 'CUSTOMER') {
          // Customer creates appointment → needs confirmation
          initialStatus = 'PENDING_CONFIRMATION';
        } else if (currentUser?.role === 'ADMIN' || currentUser?.role === 'EMPLOYEE') {
          // Admin/Employee creates appointment → directly pending (can be settled immediately)
          initialStatus = 'PENDING';
        }

        // Create appointment
        const created = await tx.appointment.create({
          data: {
            customerId: dto.customerId,
            employeeId: dto.employeeId || null,
            calendarDateId, // Add calendar reference
            services: servicesSnapshot as any,
            scheduledAt,
            durationMin: finalDuration,
            status: initialStatus,
            notes: dto.notes,
            clientOpId: clientOpId || null,
          },
          include: APPOINTMENT_DETAIL_INCLUDE,
        });

        return created;
      },
      { maxWait: 5_000, timeout: 30_000 },
    );

    // Side effects after commit (failures must not roll back the reservation)
    try {
      // If customer has no preferred barber, attach appointment barber (null-only).
      if (dto.employeeId && dto.customerId) {
        await this.prisma.customer.updateMany({
          where: {
            id: dto.customerId,
            preferredEmployeeId: null,
          },
          data: { preferredEmployeeId: dto.employeeId },
        });
      }
    } catch (e) {
      console.warn(
        '[PREFERRED] attach preferredEmployeeId failed:',
        (e as any)?.message || e,
      );
    }
    try {
      await this.notifyAppointmentCreated(appointment);
    } catch (e) {
      console.warn('[NOTIFY] Appointment created notify failed:', (e as any)?.message || e);
    }
    this.enqueueAppointmentSms('Created', () => this.sendAppointmentCreatedSms(appointment));

    return this.formatAppointment(appointment);
  }

  /** Build jalaliDate, time, serviceNames for SMS. Uses calendarDate when present else toJalali(scheduledAt). */
  private getAppointmentSmsVars(appointment: any): {
    jalaliDate: string;
    time: string;
    serviceNames: string;
    employeeName: string;
    customerName: string;
  } {
    const scheduledAt = new Date(appointment.scheduledAt);
    const jalaliDate =
      appointment.calendarDate?.jalaliDate ?? this.calendarService.toJalali(scheduledAt);
    const time = scheduledAt.toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tehran',
      hour12: false,
    });
    const servicesList = (appointment.services as ServiceSnapshot[] | undefined) ?? [];
    const serviceNames =
      servicesList.map((s) => s.serviceName).filter(Boolean).join('، ') || '—';
    return {
      jalaliDate,
      time,
      serviceNames,
      employeeName: appointment.employee?.user?.name || 'آرایشگر',
      customerName: appointment.customer?.user?.name || 'مشتری',
    };
  }

  /**
   * Send SMS to customer and employee when appointment is created (pending approval).
   * Branded copy. Failures are logged only; never thrown.
   */
  private async sendAppointmentCreatedSms(appointment: any): Promise<void> {
    const { jalaliDate, time, serviceNames, employeeName, customerName } =
      this.getAppointmentSmsVars(appointment);

    const vars = { jalaliDate, time, serviceNames, employeeName, customerName };
    const customerMessage = await this.smsTemplates.renderByKey(
      SMS_TEMPLATE_KEYS.APPOINTMENT_CREATED_CUSTOMER,
      vars,
    );
    const barberMessage = await this.smsTemplates.renderByKey(
      SMS_TEMPLATE_KEYS.APPOINTMENT_CREATED_BARBER,
      vars,
    );

    const customerPhone = appointment.customer?.user?.phone;
    if (customerPhone) {
      try {
        const result = await this.sendPolicySms(
          'appointment.created',
          customerPhone,
          customerMessage,
          `appointment.created:customer:${appointment.id}`,
          appointment.id,
          SMS_TEMPLATE_KEYS.APPOINTMENT_CREATED_CUSTOMER,
        );
        if (!result.success && !result.skipped) {
          console.error(`[SMS] Customer notification failed for appointment ${appointment.id}: ${result.reason}`);
        }
      } catch (e) {
        console.warn(`[SMS] Customer SMS failed but flow continues for appointment ${appointment.id}:`, e?.message || e);
      }
    }

    const employeePhone = appointment.employee?.user?.phone;
    if (employeePhone) {
      try {
        const result = await this.sendPolicySms(
          'appointment.created',
          employeePhone,
          barberMessage,
          `appointment.created:employee:${appointment.id}`,
          appointment.id,
          SMS_TEMPLATE_KEYS.APPOINTMENT_CREATED_BARBER,
        );
        if (!result.success && !result.skipped) {
          console.error(`[SMS] Employee notification failed for appointment ${appointment.id}: ${result.reason}`);
        }
      } catch (e) {
        console.warn(`[SMS] Employee SMS failed but flow continues for appointment ${appointment.id}:`, e?.message || e);
      }
    }
  }

  /**
   * Send SMS to customer when appointment is confirmed. Non-blocking.
   */
  private async sendAppointmentConfirmedSms(appointment: any): Promise<void> {
    const customerPhone = appointment.customer?.user?.phone;
    if (!customerPhone) return;
    const { jalaliDate, time, serviceNames, employeeName } = this.getAppointmentSmsVars(appointment);
    const message = await this.smsTemplates.renderByKey(
      SMS_TEMPLATE_KEYS.APPOINTMENT_CONFIRMED_CUSTOMER,
      { jalaliDate, time, serviceNames, employeeName },
    );
    try {
      const result = await this.sendPolicySms(
        'appointment.confirmed',
        customerPhone,
        message,
        `appointment.confirmed:customer:${appointment.id}`,
        appointment.id,
        SMS_TEMPLATE_KEYS.APPOINTMENT_CONFIRMED_CUSTOMER,
      );
      if (!result.success && !result.skipped) {
        console.error(`[SMS] Confirmed notification failed for appointment ${appointment.id}: ${result.reason}`);
      }
    } catch (e) {
      console.warn(`[SMS] Confirmed SMS failed but flow continues for appointment ${appointment.id}:`, e?.message || e);
    }
  }

  /**
   * Send SMS to customer when appointment is cancelled. Non-blocking.
   */
  private async sendAppointmentCancelledSms(appointment: any): Promise<void> {
    const customerPhone = appointment.customer?.user?.phone;
    if (!customerPhone) return;
    const { jalaliDate, time, employeeName } = this.getAppointmentSmsVars(appointment);
    const message = await this.smsTemplates.renderByKey(
      SMS_TEMPLATE_KEYS.APPOINTMENT_CANCELLED_CUSTOMER,
      { jalaliDate, time, employeeName },
    );
    try {
      const result = await this.sendPolicySms(
        'appointment.cancelled',
        customerPhone,
        message,
        `appointment.cancelled:customer:${appointment.id}`,
        appointment.id,
        SMS_TEMPLATE_KEYS.APPOINTMENT_CANCELLED_CUSTOMER,
      );
      if (!result.success && !result.skipped) {
        console.error(`[SMS] Cancelled notification failed for appointment ${appointment.id}: ${result.reason}`);
      }
    } catch (e) {
      console.warn(`[SMS] Cancelled SMS failed but flow continues for appointment ${appointment.id}:`, e?.message || e);
    }
  }

  /**
   * Shared list/summary filter builder (role scope + query filters).
   * Date axis is always scheduledAt.
   */
  private async buildAppointmentListWhere(
    query: QueryAppointmentsDto,
    currentUser?: any,
  ): Promise<Prisma.AppointmentWhereInput> {
    const where: Prisma.AppointmentWhereInput = {
      deletedAt: null,
    };

    if (currentUser) {
      if (currentUser.role === 'CUSTOMER') {
        const customer = await this.prisma.customer.findUnique({
          where: { userId: currentUser.id },
        });
        if (!customer) {
          throw new ForbiddenException('Customer profile not found');
        }
        where.customerId = customer.id;
      } else if (isEmployeeRole(currentUser)) {
        const employee = await this.requireEmployeeActor(currentUser);
        where.employeeId = scopedEmployeeListId(employee.id, query.employeeId);
      }
    }

    // CUSTOMER is already scoped to their own profile; never honor a foreign customerId.
    if (query.customerId && currentUser?.role !== 'CUSTOMER') {
      where.customerId = query.customerId;
    }
    // EMPLOYEE list scope already bound above; never honor a foreign employeeId.
    if (query.employeeId && !isEmployeeRole(currentUser)) {
      where.employeeId = query.employeeId;
    }
    if (query.status) where.status = query.status;

    if (query.from || query.to) {
      where.scheduledAt = {};
      if (query.from) where.scheduledAt.gte = new Date(query.from);
      if (query.to) where.scheduledAt.lte = new Date(query.to);
    }

    if (query.search) {
      where.customer = {
        user: {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search } },
          ],
        },
      };
    }

    return where;
  }

  /**
   * Get appointments with filters
   */
  async findAll(query: QueryAppointmentsDto, currentUser?: any) {

    const where = await this.buildAppointmentListWhere(query, currentUser);
    const take = query.take || 200;
    const skip = query.skip || 0;

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: APPOINTMENT_DETAIL_INCLUDE,
      orderBy: { scheduledAt: 'desc' },
      skip,
      take,
    });

    const count = await this.prisma.appointment.count({ where });

    return {
      data: appointments.map((a) => this.formatAppointment(a)),
      total: count,
      skip,
      take,
    };
  }

  /**
   * Aggregate counts + settled sales for the same filters as findAll (no take/skip).
   * Settled sales: status IN (SETTLED, PAID), intersected with query.status when set.
   */
  async getSummary(query: QueryAppointmentsDto, currentUser?: any) {

    const where = await this.buildAppointmentListWhere(query, currentUser);
    const totalCount = await this.prisma.appointment.count({ where });

    const settledOk =
      !query.status || query.status === 'SETTLED' || query.status === 'PAID';

    if (!settledOk) {
      return {
        totalCount,
        settledCount: 0,
        settledSalesRial: '0',
      };
    }

    const settledWhere: Prisma.AppointmentWhereInput = {
      ...where,
      status: query.status ? query.status : { in: ['SETTLED', 'PAID'] },
    };

    const [settledCount, settledAgg] = await Promise.all([
      this.prisma.appointment.count({ where: settledWhere }),
      this.prisma.appointment.aggregate({
        where: settledWhere,
        _sum: { amount: true },
      }),
    ]);

    const sum = settledAgg._sum.amount;
    const settledSalesRial =
      sum === null || sum === undefined ? '0' : sum.toString();

    return {
      totalCount,
      settledCount,
      settledSalesRial,
    };
  }

  /**
   * Find one appointment by ID
   */
  async findOne(id: number, currentUser?: any) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...APPOINTMENT_DETAIL_INCLUDE,
        transactions: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException(APPOINTMENT_NOT_FOUND_FA);
    }

    await this.assertAppointmentReadAccess(appointment, currentUser);

    return this.formatAppointment(appointment);
  }

  /**
   * Update appointment
   */
  async update(id: number, dto: UpdateAppointmentDto, currentUser?: any) {
    const existing = await this.findOne(id, currentUser);

    if (isEmployeeRole(currentUser)) {
      const actorEmployee = await this.requireEmployeeActor(currentUser);
      assertEmployeeNotImpersonating(dto.employeeId, actorEmployee.id);
      if (dto.employeeId != null) {
        dto.employeeId = actorEmployee.id;
      }
    }

    if (existing.financiallyLockedAt) {
      throw new BadRequestException(
        'این نوبت پس از تسویه کمیسیون قفل مالی شده و قابل ویرایش نیست',
      );
    }

    // Build update data
    const updateData: any = {};

    if (dto.customerId !== undefined) updateData.customerId = dto.customerId;
    if (dto.employeeId !== undefined) updateData.employeeId = dto.employeeId;
    if (dto.scheduledAt !== undefined) updateData.scheduledAt = new Date(dto.scheduledAt);
    if (dto.durationMin !== undefined) updateData.durationMin = dto.durationMin;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.status !== undefined) updateData.status = dto.status;

    // Handle services update
    if (dto.services) {
      const servicesSnapshot: ServiceSnapshot[] = [];
      let totalDuration = 0;

      for (const serviceDto of dto.services) {
        const service = await this.prisma.service.findUnique({
          where: { id: serviceDto.serviceId },
        });

        if (!service) {
          throw new NotFoundException(`Service with ID ${serviceDto.serviceId} not found`);
        }

        const priceAtBooking = serviceDto.priceAtBooking !== undefined
          ? serviceDto.priceAtBooking
          : Math.floor(service.price * 10);

        const durationMin = serviceDto.durationMin !== undefined
          ? serviceDto.durationMin
          : service.durationMinutes;

        servicesSnapshot.push({
          serviceId: service.id,
          priceAtBooking,
          durationMin,
          serviceName: service.name,
        });

        totalDuration += durationMin;
      }

      updateData.services = servicesSnapshot as any;
      if (!dto.durationMin) {
        updateData.durationMin = totalDuration;
      }
    }

    // Check overlap if employee or time changed
    if ((dto.employeeId || dto.scheduledAt || dto.durationMin) && updateData.employeeId) {
      const hasOverlap = await this.checkOverlap(
        updateData.employeeId,
        updateData.scheduledAt || new Date(existing.scheduledAt),
        updateData.durationMin || existing.durationMin,
        id // exclude current appointment
      );

      if (hasOverlap) {
        throw new BadRequestException('تداخل زمانی با نوبت دیگر');
      }
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        customer: { include: { user: true } },
        employee: { include: { user: true } },
        paidByUser: { select: { id: true, name: true } },
      },
    });

    return this.formatAppointment(updated);
  }

  /**
   * Soft delete appointment
   */
  async remove(id: number, currentUser?: any) {
    const appointment = await this.findOne(id, currentUser);

    if (appointment.status === 'SETTLED' || appointment.status === 'PAID') {
      throw new BadRequestException('نمی‌توان نوبت تسویه شده را حذف کرد');
    }

    await this.prisma.appointment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Appointment deleted successfully' };
  }

  /**
   * Get available time slots for an employee on a given date
   * Enhanced with WorkSchedule and BlockedTime
   */
  async getAvailableSlots(dto: GetSlotsDto, currentUser?: any) {
    const {
      employeeId,
      date,
      durationMin = BOOKING_DURATION_MIN,
      bufferMin = 0,
      slotIntervalMin = SLOT_INTERVAL_MIN,
    } = dto;

    const isStaff =
      currentUser?.role === 'ADMIN' || currentUser?.role === 'EMPLOYEE';

    // [TZ-VALIDATE STEP 1] Server time (no logic change)


    // Validate employee
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }

    // Parse date (input: YYYY-MM-DD in Gregorian). Use noon UTC so the calendar day is unambiguous.
    const targetDate = new Date(date + 'T12:00:00.000Z');
    const gy = targetDate.getUTCFullYear();
    const gm = targetDate.getUTCMonth();
    const gd = targetDate.getUTCDate();

    // Weekday for work_schedules: schema is 0=Sunday, 1=Monday, ..., 6=Saturday (Gregorian).
    // Use UTC weekday of this date so it is deterministic and matches DB convention.
    // Do NOT use calendar.jalaliDayOfWeek here — it can disagree with DB (e.g. server TZ at creation).
    const weekday = targetDate.getUTCDay();

    // Asia/Tehran: UTC+3:30. Midnight Tehran for this Gregorian day = UTC midnight minus 3.5h.
    const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;
    const utcMidnightThatDay = Date.UTC(gy, gm, gd, 0, 0, 0, 0);
    const tehranMidnightUtc = new Date(utcMidnightThatDay - TEHRAN_OFFSET_MS);
    const tehranDayEndUtc = new Date(tehranMidnightUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

    // Query range: full Tehran day (so we see all appointments on that day)
    const startOfDay = tehranMidnightUtc;
    const endOfDay = tehranDayEndUtc;


    // Get work schedule for this weekday (0=Sunday .. 6=Saturday, matches schema)
    const workSchedules = await this.prisma.workSchedule.findMany({
      where: {
        employeeId,
        weekday,
        isActive: true,
      },
      orderBy: { startTime: 'asc' },
    });


    // Runtime fallback when no work_schedules row exists for this weekday (do not insert into DB)
    if (workSchedules.length === 0) {
      console.warn('[WORKSCHEDULE-FALLBACK]', {
        employeeId,
        weekday,
        fallbackApplied: true,
      });
    }

    // Working hours: from DB or fallback 10:00–22:00 Asia/Tehran (hours from Tehran midnight)
    const workingHours = this.clampBusinessHours(
      workSchedules.length > 0
        ? workSchedules.map(ws => {
            const [startHour, startMin] = ws.startTime.split(':').map(Number);
            const [endHour, endMin] = ws.endTime.split(':').map(Number);
            return {
              start: startHour + startMin / 60,
              end: endHour + endMin / 60,
            };
          })
        : [{ start: BUSINESS_HOUR_START, end: BUSINESS_HOUR_END }],
    );

    // [TZ-VALIDATE STEP 2] Window bounds (no logic change)
    const win = workingHours[0];
    const windowStartUtc = new Date(tehranMidnightUtc.getTime() + win.start * 60 * 60 * 1000);
    const windowEndUtc = new Date(tehranMidnightUtc.getTime() + win.end * 60 * 60 * 1000);

    // Get existing appointments (on this Tehran day)
    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        employeeId,
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          notIn: ['CANCELLED'],
        },
        deletedAt: null,
      },
      select: {
        id: true,
        scheduledAt: true,
        durationMin: true,
        status: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });
    
    existingAppointments.forEach(apt => {
    });

    // Get blocked times
    const blockedTimes = await this.prisma.blockedTime.findMany({
      where: {
        employeeId,
        OR: [
          {
            AND: [
              { startAt: { gte: startOfDay } },
              { startAt: { lt: endOfDay } },
            ],
          },
          {
            AND: [
              { endAt: { gt: startOfDay } },
              { endAt: { lte: endOfDay } },
            ],
          },
          {
            AND: [
              { startAt: { lte: startOfDay } },
              { endAt: { gte: endOfDay } },
            ],
          },
        ],
      },
    });


    const tehranTimeOpts = { timeZone: 'Asia/Tehran' as const, hour: '2-digit' as const, minute: '2-digit' as const, hour12: false };

    // Build available slots (window bounds are 10:00–22:00 Tehran in UTC)
    const availableSlots: { time: string; displayTime: string; endTime: string }[] = [];

    for (const window of workingHours) {
      let currentTime = new Date(tehranMidnightUtc.getTime() + window.start * 60 * 60 * 1000);
      const windowEnd = new Date(tehranMidnightUtc.getTime() + window.end * 60 * 60 * 1000);

      while (currentTime < windowEnd) {
        const slotEnd = new Date(currentTime.getTime() + durationMin * 60 * 1000);

        const hasAppointmentOverlap = existingAppointments.some(apt => {
          const aptStart = apt.scheduledAt;
          const aptEnd = new Date(aptStart.getTime() + apt.durationMin * 60 * 1000);
          return this.intervalsOverlap(currentTime, slotEnd, aptStart, aptEnd);
        });

        const hasBlockedOverlap = blockedTimes.some(block =>
          this.intervalsOverlap(currentTime, slotEnd, block.startAt, block.endAt),
        );

        if (!hasAppointmentOverlap && !hasBlockedOverlap) {
          availableSlots.push({
            time: currentTime.toISOString(),
            endTime: slotEnd.toISOString(),
            displayTime: currentTime.toLocaleTimeString('fa-IR', tehranTimeOpts),
          });
        }

        currentTime = new Date(currentTime.getTime() + slotIntervalMin * 60 * 1000);
      }
    }


    // Build ALL slots (including busy ones for better UX); window = 10:00–22:00 Tehran in UTC
    const allSlots: { time: string; displayTime: string; endTime: string; available: boolean; reason?: string }[] = [];

    for (const window of workingHours) {
      let currentTime = new Date(tehranMidnightUtc.getTime() + window.start * 60 * 60 * 1000);
      const windowEnd = new Date(tehranMidnightUtc.getTime() + window.end * 60 * 60 * 1000);

      while (currentTime < windowEnd) {
        const slotEnd = new Date(currentTime.getTime() + durationMin * 60 * 1000);

        const conflictingAppointment = existingAppointments.find(apt => {
          const aptStart = apt.scheduledAt;
          const aptEnd = new Date(aptStart.getTime() + apt.durationMin * 60 * 1000);
          return this.intervalsOverlap(currentTime, slotEnd, aptStart, aptEnd);
        });

        const conflictingBlock = blockedTimes.find(block =>
          this.intervalsOverlap(currentTime, slotEnd, block.startAt, block.endAt),
        );

        const available = !conflictingAppointment && !conflictingBlock;
        let reason: string | undefined;
        if (conflictingAppointment) reason = `Appointment #${conflictingAppointment.id} (${conflictingAppointment.status})`;
        else if (conflictingBlock) reason = `Blocked time`;

        allSlots.push({
          time: currentTime.toISOString(),
          endTime: slotEnd.toISOString(),
          displayTime: currentTime.toLocaleTimeString('fa-IR', tehranTimeOpts),
          available,
          ...(reason && { reason }),
        });

        currentTime = new Date(currentTime.getTime() + slotIntervalMin * 60 * 1000);
      }
    }

    const { nowUtc } = this.getTehranNow();

    // Min 2h rule for public/customer callers: any slot earlier than now+2h
    // (Asia/Tehran clock, compared in UTC), including early next-day slots.
    if (!isStaff) {
      const minGapMinutes = 2 * 60;
      for (const slot of allSlots) {
        const gapMinutes = (new Date(slot.time).getTime() - nowUtc.getTime()) / 60000;
        if (gapMinutes < minGapMinutes && slot.available) {
          slot.available = false;
          slot.reason = gapMinutes < 0 ? 'past' : 'min_2h';
        }
      }
    }

    const firstAvailableSlot = allSlots.find(s => s.available)?.time ?? null;
    const availableCount = allSlots.filter(s => s.available).length;
    const busyCount = allSlots.filter(s => !s.available).length;

    return {
      date,
      employeeId,
      durationMin,
      bufferMin,
      slots: allSlots,
      totalSlots: allSlots.length,
      availableSlots: availableCount,
      busySlots: busyCount,
      firstAvailableSlot,
    };
  }

  /**
   * Get earliest available slot from today (Asia/Tehran) for an employee + service.
   * Reuses getAvailableSlots (same TZ, overlap, blocked, 2h rule). Max 30 days.
   */
  async getEarliestAvailableSlot(employeeId: number, serviceId: number) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, durationMinutes: true },
    });
    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }

    const { dateStr: todayTehranStr } = this.getTehranNow();

    const durationMin = BOOKING_DURATION_MIN;

    const addDaysToGregorian = (dateStr: string, days: number): string => {
      const d = new Date(dateStr + 'T12:00:00.000Z');
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };

    for (let i = 0; i < 30; i++) {
      const dateStr = addDaysToGregorian(todayTehranStr, i);

      const result = await this.getAvailableSlots({
        employeeId,
        date: dateStr,
        durationMin,
        slotIntervalMin: SLOT_INTERVAL_MIN,
      });

      const first = result.slots.find((s) => s.available);

      if (first) {
        const gregorianDate = new Date(dateStr + 'T12:00:00.000Z');
        const jalaliDate = this.calendarService.toJalali(gregorianDate);
        return {
          date: dateStr,
          jalaliDate,
          time: first.time,
          displayTime: first.displayTime,
          endTime: first.endTime,
        };
      }
    }

    throw new NotFoundException({ message: 'NO_AVAILABLE_SLOT' });
  }

  /**
   * Settle appointment (ADMIN only)
   * Creates accounting transactions and handles debt if needed
   */
  async settle(id: number, dto: SettleAppointmentDto, adminUser: any) {

    const appointment = await this.findOne(id, adminUser);

    if (appointment.status === 'SETTLED' || appointment.status === 'PAID') {
      throw new ConflictException('این نوبت قبلاً تسویه شده است');
    }

    if (appointment.financiallyLockedAt) {
      throw new ConflictException(
        'این نوبت قفل مالی شده و قابل تسویه مجدد نیست',
      );
    }

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('نمی‌توان نوبت لغو شده را تسویه کرد');
    }

    // Resolve paid / debt split (RIAL integers — codebase uses BigInt, not Prisma.Decimal)
    const totalRial = BigInt(dto.amount);
    let paidRial: bigint;
    let debtRial: bigint;
    if (dto.paidAmount == null && dto.debtAmount == null) {
      if (dto.paymentMethod === 'DEBT') {
        paidRial = 0n;
        debtRial = totalRial;
      } else {
        paidRial = totalRial;
        debtRial = 0n;
      }
    } else {
      paidRial = BigInt(dto.paidAmount ?? 0);
      debtRial = BigInt(dto.debtAmount ?? 0);
    }
    if (paidRial + debtRial !== totalRial) {
      throw new BadRequestException(
        'جمع مبلغ پرداختی و بدهی باید برابر مبلغ کل نوبت باشد',
      );
    }
    if (paidRial > 0n && dto.paymentMethod === 'DEBT') {
      throw new BadRequestException(
        'برای بخش پرداخت‌شده، روش پرداخت نقدی یا کارت را انتخاب کنید',
      );
    }
    if (paidRial > 0n && !dto.accountId) {
      throw new BadRequestException('حساب بانکی برای مبلغ پرداختی الزامی است');
    }
    if (paidRial === 0n && debtRial === 0n) {
      throw new BadRequestException('مبلغ تسویه نمی‌تواند صفر باشد');
    }

    // Check for duplicate settlement (idempotency via externalRef)
    if (dto.externalRef) {
      const existingTransaction = await this.prisma.transaction.findFirst({
        where: {
          meta: {
            path: ['externalRef'],
            equals: dto.externalRef,
          },
        },
      });

      if (existingTransaction) {
        return this.findOne(id, adminUser);
      }
    }

    // Block duplicate settlement when externalRef is absent (race / retry safety)
    const existingSettlementIncome = await this.prisma.transaction.findFirst({
      where: {
        sourceType: 'APPOINTMENT',
        sourceId: id,
        type: 'INCOME',
        deletedAt: null,
      },
    });
    if (existingSettlementIncome) {
      throw new ConflictException('این نوبت قبلاً تسویه شده است');
    }

    if (debtRial > 0n) {
      const existingDebt = await this.prisma.customerDebt.findFirst({
        where: {
          OR: [
            { sourceType: 'APPOINTMENT', sourceId: id },
            { appointmentId: id },
          ],
        },
      });
      if (existingDebt) {
        throw new ConflictException('بدهی این نوبت قبلاً ثبت شده است');
      }
    }

    const tipRial =
      dto.tipAmount && dto.tipAmount > 0 ? BigInt(dto.tipAmount) : null;
    if (tipRial) {
      if (!dto.tipRecipientType) {
        throw new BadRequestException('انتخاب نوع گیرنده انعام الزامی است');
      }
      if (
        dto.tipRecipientType === TipRecipientType.INDIVIDUAL &&
        !dto.tipRecipientEmployeeId
      ) {
        throw new BadRequestException(
          'انتخاب پرسنل خدمات برای انعام فردی الزامی است',
        );
      }
    }

    const storedPaymentMethod =
      paidRial > 0n ? dto.paymentMethod : ('DEBT' as const);

    const updated = await this.prisma.$transaction(async (tx) => {
      // Row lock held until this interactive transaction commits or rolls back.
      // Concurrent settle waits here, then re-reads the winner's committed status.
      await tx.$queryRaw`SELECT id FROM "appointments" WHERE id = ${id} FOR UPDATE`;

      const lockedAppointment = await tx.appointment.findUnique({ where: { id } });
      if (!lockedAppointment || lockedAppointment.deletedAt) {
        throw new NotFoundException(APPOINTMENT_NOT_FOUND_FA);
      }
      if (
        lockedAppointment.status === 'SETTLED' ||
        lockedAppointment.status === 'PAID'
      ) {
        throw new ConflictException('این نوبت قبلاً تسویه شده است');
      }

      if (lockedAppointment.financiallyLockedAt) {
        throw new ConflictException(
          'این نوبت قفل مالی شده و قابل تسویه مجدد نیست',
        );
      }

      if (lockedAppointment.status === 'CANCELLED') {
        throw new BadRequestException('نمی‌توان نوبت لغو شده را تسویه کرد');
      }

      const settlementIncome = await tx.transaction.findFirst({
        where: {
          sourceType: 'APPOINTMENT',
          sourceId: id,
          type: 'INCOME',
          deletedAt: null,
        },
      });
      if (settlementIncome) {
        throw new ConflictException('این نوبت قبلاً تسویه شده است');
      }

      if (debtRial > 0n) {
        const settlementDebt = await tx.customerDebt.findFirst({
          where: {
            OR: [
              { sourceType: 'APPOINTMENT', sourceId: id },
              { appointmentId: id },
            ],
          },
        });
        if (settlementDebt) {
          throw new ConflictException('بدهی این نوبت قبلاً ثبت شده است');
        }
      }

      const deductionPerAppointmentAmount = BigInt(BARBER_APPOINTMENT_DEDUCTION_RIAL);
      const barberPayoutGrossAmount = BigInt(dto.amount);
      const settlementDeductionAmount = deductionPerAppointmentAmount;
      const barberPayoutNetAmount = barberPayoutGrossAmount - settlementDeductionAmount;

      let tipRecipientType: TipRecipientType | null = null;
      let tipRecipientEmployeeId: number | null = null;
      let tipStaffShareRial: bigint | null = null;
      let tipSalonShareRial: bigint | null = null;
      const tipAllocationRows: { employeeId: number; amountRial: bigint }[] = [];

      let tipTeamMemberIds: number[] | null = null;

      if (tipRial && dto.tipRecipientType) {
        tipRecipientType = dto.tipRecipientType;
        const shares = computeTipShares(tipRial);
        tipStaffShareRial = shares.staffShare;
        tipSalonShareRial = shares.salonShare;

        if (dto.tipRecipientType === TipRecipientType.INDIVIDUAL) {
          await this.assertEligibleServiceStaff(tx, dto.tipRecipientEmployeeId!);
          tipRecipientEmployeeId = dto.tipRecipientEmployeeId!;
          tipAllocationRows.push(
            ...computePersonalTipAllocations(tipRial, tipRecipientEmployeeId).map(
              (r) => ({ employeeId: r.employeeId, amountRial: r.amountRial }),
            ),
          );
        } else {
          tipRecipientEmployeeId = null;
          let memberIds = (dto.tipTeamMemberIds || [])
            .map(Number)
            .filter((n) => Number.isInteger(n) && n > 0);
          if (memberIds.length === 0) {
            memberIds = await this.findActiveServiceStaffIds(tx);
          }
          memberIds = [...new Set(memberIds)];
          if (memberIds.length === 0) {
            throw new BadRequestException(
              'برای انعام تیمی حداقل یک پرسنل خدمات فعال لازم است',
            );
          }
          for (const mid of memberIds) {
            await this.assertEligibleServiceStaff(tx, mid);
          }
          tipTeamMemberIds = memberIds;
          tipAllocationRows.push(
            ...computeTeamTipAllocations(tipRial, appointment.employeeId, memberIds).map(
              (r) => ({ employeeId: r.employeeId, amountRial: r.amountRial }),
            ),
          );
        }
      }

      const updated = await tx.appointment.update({
        where: { id },
        data: {
          amount: BigInt(dto.amount),
          barberPayoutGrossAmount,
          settlementDeductionAmount,
          barberPayoutNetAmount,
          deductionPerAppointmentAmount,
          tipAmount: tipRial,
          tipRecipientType: tipRecipientType ?? undefined,
          tipRecipientEmployeeId,
          tipStaffShareRial,
          tipSalonShareRial,
          tipTeamMemberIds: tipTeamMemberIds ?? undefined,
          paymentMethod: storedPaymentMethod,
          accountId: paidRial > 0n ? dto.accountId || null : null,
          paidAt: new Date(),
          paidBy: adminUser.sub || adminUser.id,
          status: 'SETTLED',
          notes: dto.notes ? `${appointment.notes || ''}\n${dto.notes}` : appointment.notes,
        },
        include: APPOINTMENT_DETAIL_INCLUDE,
      });

      if (tipAllocationRows.length > 0) {
        await tx.appointmentTipAllocation.createMany({
          data: tipAllocationRows.map((row) => ({
            appointmentId: id,
            employeeId: row.employeeId,
            amountRial: row.amountRial,
          })),
        });
      }

      const meta = {
        appointmentId: id,
        employeeId: appointment.employeeId,
        customerId: appointment.customerId,
        adminId: adminUser.sub || adminUser.id,
        externalRef: dto.externalRef,
        paidAmount: paidRial.toString(),
        debtAmount: debtRial.toString(),
      };

      if (debtRial > 0n) {
        await tx.customerDebt.create({
          data: {
            customerId: appointment.customerId,
            appointmentId: id,
            amount: debtRial,
            sourceType: 'APPOINTMENT',
            sourceId: id,
            description:
              paidRial > 0n
                ? `بدهی باقیمانده نوبت #${id} (پرداخت‌شده: ${paidRial.toString()} ریال)`
                : `بدهی نوبت #${id}`,
            meta: meta as any,
          },
        });
      }

      if (paidRial > 0n) {
        await tx.transaction.create({
          data: {
            type: 'INCOME',
            amount: paidRial,
            description:
              debtRial > 0n
                ? `درآمد جزئی نوبت #${id} (بدهی: ${debtRial.toString()} ریال)`
                : `درآمد نوبت #${id}`,
            sourceType: 'APPOINTMENT',
            sourceId: id,
            accountId: dto.accountId,
            paymentMethod: dto.paymentMethod,
            occurredAt: new Date(),
            createdBy: adminUser.sub || adminUser.id,
            meta: meta as any,
          },
        });

        if (dto.accountId) {
          await tx.bankAccount.update({
            where: { id: dto.accountId },
            data: { balance: { increment: paidRial } },
          });
        }


        if (tipRial && tipRial > 0n) {
          const tipDescription = buildAppointmentTipDescription({
            appointmentId: id,
            customerName: appointment.customer?.user?.name,
            barberName: appointment.employee?.user?.name,
            tipRecipientType,
          });
          await tx.transaction.create({
            data: {
              type: 'INCOME',
              amount: tipRial,
              description: tipDescription,
              sourceType: 'TIP',
              sourceId: id,
              accountId: dto.accountId,
              paymentMethod: dto.paymentMethod,
              occurredAt: new Date(),
              createdBy: adminUser.sub || adminUser.id,
              meta: {
                ...meta,
                isTip: true,
                tipRecipientType,
                tipStaffShareRial: tipStaffShareRial?.toString(),
                tipSalonShareRial: tipSalonShareRial?.toString(),
              } as any,
            },
          });

          if (dto.accountId) {
            await tx.bankAccount.update({
              where: { id: dto.accountId },
              data: { balance: { increment: tipRial } },
            });
          }

        }
      }

      // Store lines: AppointmentProduct + APPOINTMENT_SALE movement only.
      // Do NOT write a Transaction and do NOT add to Appointment.amount.
      if (dto.items?.length) {
        await this.applyAppointmentProductSales(
          tx,
          id,
          dto.items,
          adminUser.sub || adminUser.id,
        );
      }

      return updated;
    }, { maxWait: 5_000, timeout: 30_000 });

    try {
      await this.notifyAppointmentSettled(updated, dto.amount, dto.tipAmount || 0);
    } catch (e) {
      console.warn('[NOTIFY] Settlement notify failed:', (e as any)?.message || e);
    }

    try {
      const tipAllocations = await this.prisma.appointmentTipAllocation.findMany({
        where: { appointmentId: id },
        select: { employeeId: true, amountRial: true },
      });
      if (tipAllocations.length > 0) {
        await this.tipAlertService.notifyTipRecipients({
          sourceKey: `appointment:${id}`,
          sourceLabel: `تسویه نوبت #${id}`,
          customerName: updated.customer?.user?.name,
          barberName: updated.employee?.user?.name,
          allocations: tipAllocations.map((a) => ({
            employeeId: a.employeeId,
            amountRial: a.amountRial,
          })),
        });
      }
    } catch (e) {
      console.warn('[NOTIFY] Tip alert failed:', (e as any)?.message || e);
    }

    return this.formatAppointment(updated);
  }

  /**
   * Revert settlement (ADMIN only). Undo settlement so appointment can be deleted.
   * Soft-deletes related transactions, restores bank balance, removes CustomerDebt, clears appointment financial fields.
   */
  async revertSettlement(id: number, adminUser: any) {

    const locked = await this.prisma.appointment.findFirst({
      where: { id, financiallyLockedAt: { not: null } },
      select: { id: true },
    });
    if (locked) {
      throw new BadRequestException(
        'این نوبت در تسویه کمیسیون قفل شده و برگشت تسویه مشتری مجاز نیست',
      );
    }

    const appointment = await this.findOne(id, adminUser);

    if (appointment.status !== 'SETTLED' && appointment.status !== 'PAID') {
      throw new BadRequestException('فقط نوبت‌های تسویه شده قابل برگشت از تسویه هستند');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      // A) Find all transactions for this appointment (INCOME + TIP) not yet soft-deleted
      const transactions = await tx.transaction.findMany({
        where: {
          OR: [
            { sourceType: 'APPOINTMENT', sourceId: id },
            { sourceType: 'TIP', sourceId: id },
          ],
          deletedAt: null,
        },
      });


      for (const txn of transactions) {
        if (txn.accountId != null) {
          await tx.bankAccount.update({
            where: { id: txn.accountId },
            data: { balance: { decrement: txn.amount } },
          });
        }
        await tx.transaction.update({
          where: { id: txn.id },
          data: { deletedAt: now },
        });
      }

      // D) Remove CustomerDebt linked to this appointment (if settled as DEBT / hybrid)
      const deletedDebts = await tx.customerDebt.deleteMany({
        where: {
          OR: [
            { sourceType: 'APPOINTMENT', sourceId: id },
            { appointmentId: id },
          ],
        },
      });
      if (deletedDebts.count > 0) {
      }

      await tx.appointmentTipAllocation.deleteMany({
        where: { appointmentId: id },
      });

      const restockTransitions = await this.reverseAppointmentProductSales(
        tx,
        id,
        adminUser.sub || adminUser.id,
      );

      // E) Clear appointment financial fields and set status to CONFIRMED
      await tx.appointment.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          amount: null,
          barberPayoutGrossAmount: null,
          settlementDeductionAmount: null,
          barberPayoutNetAmount: null,
          deductionPerAppointmentAmount: null,
          tipAmount: null,
          tipRecipientType: null,
          tipRecipientEmployeeId: null,
          tipStaffShareRial: null,
          tipSalonShareRial: null,
          paymentMethod: null,
          accountId: null,
          paidAt: null,
          paidBy: null,
        },
      });

      return { message: 'Settlement reverted successfully', restockTransitions };
    }, { maxWait: 5_000, timeout: 30_000 });

    this.stockNotifications?.scheduleBackInStock(result.restockTransitions);
    return { message: result.message };
  }

  /**
   * Cancel appointment
   */
  async cancel(id: number, currentUser: any) {
    const appointment = await this.findOne(id, currentUser);

    if (appointment.status === 'SETTLED' || appointment.status === 'PAID') {
      throw new BadRequestException('نمی‌توان نوبت تسویه شده را لغو کرد');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        customer: { include: { user: true } },
        employee: { include: { user: true } },
        calendarDate: true,
      },
    });

    // Send notification
    await this.notifyAppointmentCancelled(updated);

    this.enqueueAppointmentSms('Cancelled', () => this.sendAppointmentCancelledSms(updated));

    return this.formatAppointment(updated);
  }

  /**
   * Confirm appointment with revalidation and alternatives
   * (EMPLOYEE/ADMIN only) - change status from PENDING_CONFIRMATION to CONFIRMED
   */
  async confirm(id: number, currentUser: any) {

    const appointment = await this.findOne(id, currentUser);

    if (appointment.status !== 'PENDING_CONFIRMATION' && appointment.status !== 'PENDING') {
      throw new BadRequestException('فقط نوبت‌های در انتظار تایید قابل تایید هستند');
    }

    // Re-validate with atomic lock — notify/SMS after commit (avoid P2028)
    const updated = await this.prisma.$transaction(async (tx) => {
      if (appointment.employeeId) {
        // Acquire lock
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(CONCAT('employee:', ${appointment.employeeId}::text)))`;

        // Re-check overlaps
        const scheduledAt = new Date(appointment.scheduledAt);
        const endAt = new Date(scheduledAt.getTime() + appointment.durationMin * 60 * 1000);

        const overlapping = await tx.appointment.findFirst({
          where: {
            employeeId: appointment.employeeId,
            id: { not: id },
            status: { notIn: ['CANCELLED'] },
            deletedAt: null,
            OR: [
              {
                AND: [
                  { scheduledAt: { lte: scheduledAt } },
                  { scheduledAt: { gte: new Date(scheduledAt.getTime() - appointment.durationMin * 60 * 1000) } },
                ],
              },
              {
                AND: [
                  { scheduledAt: { gte: scheduledAt } },
                  { scheduledAt: { lt: endAt } },
                ],
              },
            ],
          },
        });

        if (overlapping) {
          const overlappingEnd = new Date(
            overlapping.scheduledAt.getTime() + overlapping.durationMin * 60 * 1000
          );

          const hasConflict = this.intervalsOverlap(
            scheduledAt,
            endAt,
            overlapping.scheduledAt,
            overlappingEnd,
          );

          if (hasConflict) {
            // Do not call getAvailableSlots inside the TX — it is slow and can expire the TX.
            throw new BadRequestException({
              statusCode: 409,
              message: 'تداخل زمانی! این زمان دیگر رزرو شده است',
              error: 'SLOT_CONFLICT',
            });
          }
        }
      }

      // Confirm appointment
      const confirmed = await tx.appointment.update({
        where: { id },
        data: { status: 'CONFIRMED' },
        include: {
          customer: { include: { user: true } },
          employee: { include: { user: true } },
          calendarDate: true,
        },
      });

      return confirmed;
    }, { maxWait: 5_000, timeout: 30_000 });

    try {
      await this.notifyAppointmentConfirmed(updated);
    } catch (e) {
      console.warn('[NOTIFY] Confirm notify failed:', (e as any)?.message || e);
    }
    this.enqueueAppointmentSms('Confirm', () => this.sendAppointmentConfirmedSms(updated));

    return this.formatAppointment(updated);
  }

  /**
   * Helper: Check for appointment time overlap
   */
  private async checkOverlap(
    employeeId: number,
    startTime: Date,
    durationMin: number,
    excludeAppointmentId?: number
  ): Promise<boolean> {
    const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);

    const overlapping = await this.prisma.appointment.findFirst({
      where: {
        employeeId,
        id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
        status: { notIn: ['CANCELLED'] },
        deletedAt: null,
        OR: [
          {
            AND: [
              { scheduledAt: { lte: startTime } },
              { scheduledAt: { gte: new Date(startTime.getTime() - 1000 * 60 * 60) } }, // within 1 hour window
            ],
          },
          {
            AND: [
              { scheduledAt: { gte: startTime } },
              { scheduledAt: { lt: endTime } },
            ],
          },
        ],
      },
    });

    if (overlapping) {
      // Double-check with duration
      const overlappingEnd = new Date(
        overlapping.scheduledAt.getTime() + overlapping.durationMin * 60 * 1000
      );

      return this.intervalsOverlap(
        startTime,
        endTime,
        overlapping.scheduledAt,
        overlappingEnd,
      );
    }

    return false;
  }

  /**
   * Get employee calendar (appointments + blocked times)
   */
  async getEmployeeCalendar(employeeId: number, fromDate: string, toDate: string) {

    const from = new Date(fromDate);
    const to = new Date(toDate);

    // Get appointments
    const appointments = await this.prisma.appointment.findMany({
      where: {
        employeeId,
        scheduledAt: {
          gte: from,
          lte: to,
        },
        status: { notIn: ['CANCELLED'] },
        deletedAt: null,
      },
      include: {
        customer: { include: { user: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Get blocked times
    const blockedTimes = await this.prisma.blockedTime.findMany({
      where: {
        employeeId,
        OR: [
          {
            AND: [
              { startAt: { gte: from } },
              { startAt: { lte: to } },
            ],
          },
          {
            AND: [
              { endAt: { gte: from } },
              { endAt: { lte: to } },
            ],
          },
        ],
      },
      orderBy: { startAt: 'asc' },
    });

    return {
      appointments: appointments.map(a => this.formatAppointment(a)),
      blockedTimes,
      totalAppointments: appointments.length,
      totalBlockedSlots: blockedTimes.length,
    };
  }

  /**
   * Create blocked time (ADMIN only)
   */
  async createBlockedTime(data: {
    employeeId: number;
    startAt: string;
    endAt: string;
    reason?: string;
    createdBy?: number;
  }) {

    const blockedTime = await this.prisma.blockedTime.create({
      data: {
        employeeId: data.employeeId,
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
        reason: data.reason,
        createdBy: data.createdBy,
      },
      include: {
        employee: { include: { user: true } },
      },
    });

    return blockedTime;
  }

  /**
   * Delete blocked time
   */
  async deleteBlockedTime(id: number) {
    await this.prisma.blockedTime.delete({
      where: { id },
    });

    return { message: 'Blocked time deleted successfully' };
  }

  /**
   * Get employee blocked times
   */
  async getBlockedTimes(employeeId: number) {
    return this.prisma.blockedTime.findMany({
      where: { employeeId },
      orderBy: { startAt: 'desc' },
    });
  }

  /**
   * Helper: Format appointment for API response
   */
  /**
   * Customer appointment history (completed/cancelled)
   */
  async getCustomerHistory(currentUser: any) {
    /**
     * SECURITY FIX:
     * Customer must be resolved by userId instead of email.
     * Email is optional and not a reliable identity key.
     */
    const customer = await this.prisma.customer.findUnique({
      where: { userId: currentUser.id },
    });

    if (!customer) {
      throw new ForbiddenException('Customer profile not found');
    }

    const appointments = await this.prisma.appointment.findMany({
      where: {
        customerId: customer.id,
        deletedAt: null,
        status: { in: ['COMPLETED', 'CANCELLED', 'SETTLED', 'PAID'] },
      },
      include: {
        customer: { include: { user: { select: APPOINTMENT_USER_SELECT } } },
        employee: { include: { user: { select: APPOINTMENT_USER_SELECT } } },
        service: true,
        calendarDate: true,
      },
      orderBy: { scheduledAt: 'desc' },
    });

    return appointments.map((a) => this.formatAppointment(a));
  }

  private formatTipRecipientEmployee(employee: any) {
    if (!employee) return null;
    return {
      id: employee.id,
      user: employee.user
        ? {
            id: employee.user.id,
            name: employee.user.name,
            phone: employee.user.phone,
            email: employee.user.email,
            role: employee.user.role,
          }
        : null,
    };
  }

  private formatAppointment(appointment: any) {
    const services = Array.isArray(appointment.services)
      ? (appointment.services as ServiceSnapshot[])
      : [];
    const normalized = normalizeAppointmentFields(appointment);
    
    // Calculate amounts in Rials (NO CONVERSION - display as is)
    const totalAmountRials = services?.reduce((sum, s) => sum + (s.priceAtBooking || 0), 0) || 0;
    const amountRials = appointment.amount ? Number(appointment.amount) : null;
    const barberPayoutGrossAmount = appointment.barberPayoutGrossAmount
      ? Number(appointment.barberPayoutGrossAmount)
      : null;
    const settlementDeductionAmount = appointment.settlementDeductionAmount
      ? Number(appointment.settlementDeductionAmount)
      : null;
    const barberPayoutNetAmount = appointment.barberPayoutNetAmount
      ? Number(appointment.barberPayoutNetAmount)
      : null;
    const deductionPerAppointmentAmount = appointment.deductionPerAppointmentAmount
      ? Number(appointment.deductionPerAppointmentAmount)
      : BARBER_APPOINTMENT_DEDUCTION_RIAL;
    const tipAmountRials = appointment.tipAmount ? Number(appointment.tipAmount) : null;
    const tipStaffShareRial = appointment.tipStaffShareRial
      ? Number(appointment.tipStaffShareRial)
      : null;
    const tipSalonShareRial = appointment.tipSalonShareRial
      ? Number(appointment.tipSalonShareRial)
      : null;
    const tipRecipientEmployee = this.formatTipRecipientEmployee(
      appointment.tipRecipientEmployee,
    );
    const tipRecipientEmployeeName =
      tipRecipientEmployee?.user?.name ?? null;

    return {
      id: appointment.id,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
      customerId: appointment.customerId,
      status: appointment.status,
      employeeId: appointment.employeeId,
      serviceId: appointment.serviceId,
      accountId: appointment.accountId,
      deletedAt: appointment.deletedAt,
      durationMin: appointment.durationMin,
      notes: appointment.notes,
      paidAt: appointment.paidAt,
      paidBy: appointment.paidBy,
      paymentMethod: appointment.paymentMethod,
      scheduledAt: appointment.scheduledAt,
      financiallyLockedAt: appointment.financiallyLockedAt,
      calendarDateId: appointment.calendarDateId,
      customer: appointment.customer
        ? {
            ...appointment.customer,
            user: appointment.customer.user
              ? {
                  id: appointment.customer.user.id,
                  name: appointment.customer.user.name,
                  phone: appointment.customer.user.phone,
                  email: appointment.customer.user.email,
                  role: appointment.customer.user.role,
                }
              : null,
          }
        : null,
      employee: appointment.employee
        ? {
            id: appointment.employee.id,
            userId: appointment.employee.userId,
            user: appointment.employee.user
              ? {
                  id: appointment.employee.user.id,
                  name: appointment.employee.user.name,
                  phone: appointment.employee.user.phone,
                  email: appointment.employee.user.email,
                  role: appointment.employee.user.role,
                }
              : null,
          }
        : null,
      tipRecipientEmployee,
      paidByUser: appointment.paidByUser ?? null,
      service: appointment.service ?? null,
      ...normalized,
      // Return amounts in RIALS (no Toman conversion)
      amount: amountRials, // RIAL
      barberPayoutGrossAmount, // RIAL
      settlementDeductionAmount, // RIAL
      barberPayoutNetAmount, // RIAL
      deductionPerAppointmentAmount, // RIAL
      tipAmount: tipAmountRials, // RIAL
      tipRecipientType: appointment.tipRecipientType ?? null,
      tipRecipientEmployeeId: appointment.tipRecipientEmployeeId ?? null,
      tipRecipientEmployeeName,
      tipStaffShareRial,
      tipSalonShareRial,
      serviceAmount: totalAmountRials, // RIAL
      totalAmount: totalAmountRials + (tipAmountRials || 0), // RIAL
      services,
      customerName: appointment.customer?.user?.name || 'Unknown',
      customerPhone: appointment.customer?.user?.phone || '',
      employeeName: normalized.employeeName ?? 'Unassigned',
      // Include calendar date information
      calendarDate: appointment.calendarDate ? {
        id: appointment.calendarDate.id,
        gregorianDate: appointment.calendarDate.gregorianDate,
        jalaliDate: appointment.calendarDate.jalaliDate,
        gregorianDayOfWeek: appointment.calendarDate.gregorianDayOfWeek,
        jalaliDayOfWeek: appointment.calendarDate.jalaliDayOfWeek,
      } : null,
    };
  }

  private mergeSettleProductItems(
    items: SettleProductItemDto[],
  ): { productId: number; quantity: number }[] {
    const merged = new Map<number, number>();
    for (const item of items) {
      merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
    }
    return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
  }

  /**
   * Snapshot store lines onto the appointment and decrement stock.
   * Runs in the SAME settle transaction so insufficient stock rolls back the whole settle.
   * Inserts: appointment_products + inventory_movements (APPOINTMENT_SALE, quantity=-qty).
   * Does not insert Transaction rows and does not change Appointment.amount.
   */
  private async applyAppointmentProductSales(
    tx: Prisma.TransactionClient,
    appointmentId: number,
    items: SettleProductItemDto[],
    performedById: number | undefined,
  ) {
    const merged = this.mergeSettleProductItems(items);
    for (const item of merged) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        throw new NotFoundException('محصول یافت نشد');
      }
      if (!product.isActive) {
        throw new BadRequestException(`محصول «${product.name}» غیرفعال است`);
      }

      const affected = await tx.$executeRaw`
        UPDATE "products"
        SET stock = stock - ${item.quantity}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${item.productId} AND stock >= ${item.quantity}
      `;
      if (affected === 0) {
        throw new ConflictException(`موجودی کافی نیست: ${product.name}`);
      }

      const lineTotalRial = product.priceRial * BigInt(item.quantity);
      await tx.appointmentProduct.create({
        data: {
          appointmentId,
          productId: item.productId,
          quantity: item.quantity,
          unitPriceRial: product.priceRial,
          lineTotalRial,
          packagingName: null,
          packagingUnit: 'عدد',
          unitsPerPackage: 1,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: InventoryMovementType.APPOINTMENT_SALE,
          quantity: -item.quantity,
          reason: 'فروش در تسویه نوبت',
          referenceType: 'APPOINTMENT',
          referenceId: appointmentId,
          performedById: performedById ?? null,
          packagingName: null,
          packagingUnit: 'عدد',
          unitsPerPackage: 1,
        },
      });
    }
  }

  /**
   * Restock APPOINTMENT_SALE lines and delete AppointmentProduct rows.
   * No-ops if a REVERSAL movement already exists for this appointment.
   */
  private async reverseAppointmentProductSales(
    tx: Prisma.TransactionClient,
    appointmentId: number,
    performedById: number | undefined,
  ) {
    const alreadyReversed = await tx.inventoryMovement.findFirst({
      where: {
        referenceType: 'APPOINTMENT',
        referenceId: appointmentId,
        type: InventoryMovementType.REVERSAL,
      },
      select: { id: true },
    });
    if (alreadyReversed) {
      return [];
    }

    const lines = await tx.appointmentProduct.findMany({
      where: { appointmentId },
    });
    const qtyByProduct = new Map<number, number>();
    for (const line of lines) {
      qtyByProduct.set(line.productId, (qtyByProduct.get(line.productId) ?? 0) + line.quantity);
    }
    const productIds = [...qtyByProduct.keys()];
    const stocks = productIds.length
      ? await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, stock: true },
        })
      : [];
    const previousById = new Map(stocks.map((row) => [row.id, row.stock]));

    for (const line of lines) {
      await tx.$executeRaw`
        UPDATE "products"
        SET stock = stock + ${line.quantity}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${line.productId}
      `;
      await tx.inventoryMovement.create({
        data: {
          productId: line.productId,
          type: InventoryMovementType.REVERSAL,
          quantity: line.quantity,
          reason: 'بازگشت فروش به دلیل ابطال تسویه',
          referenceType: 'APPOINTMENT',
          referenceId: appointmentId,
          performedById: performedById ?? null,
          packagingId: line.packagingId,
          packagingName: line.packagingName,
          packagingUnit: line.packagingUnit || 'عدد',
          unitsPerPackage: line.unitsPerPackage,
        },
      });
    }
    if (lines.length > 0) {
      await tx.appointmentProduct.deleteMany({ where: { appointmentId } });
    }

    return productIds.map((productId) => {
      const previousStock = previousById.get(productId) ?? 0;
      return {
        productId,
        previousStock,
        nextStock: previousStock + (qtyByProduct.get(productId) ?? 0),
      };
    });
  }

  /**
   * Helper: Send notification for appointment created
   */
  private async notifyAppointmentCreated(appointment: any) {
    try {
      const serviceNames = (appointment.services as ServiceSnapshot[])
        .map(s => s.serviceName)
        .join('، ');

      // Display time in Iran timezone
      const dateTime = new Date(appointment.scheduledAt).toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Tehran',
      });

      // Create notification in database
      const notification = await this.notificationsService.create({
        title: 'نوبت جدید ثبت شد',
        message: `${appointment.customer?.user?.name} خدمات ${serviceNames} را برای ${dateTime} رزرو کرد.`,
        type: 'APPOINTMENT_CREATED',
        roleTarget: 'ADMIN',
        relatedEntity: `appointment:${appointment.id}`,
      });

      // Send via WebSocket (for online users)
      this.notificationsGateway.sendToRole('ADMIN', notification);

      // 🔔 Send Push Notification to ADMIN role (for offline users)
      try {
        await this.pushNotificationsService.sendToRole('ADMIN', {
          title: 'نوبت جدید ثبت شد',
          body: `${appointment.customer?.user?.name} خدمات ${serviceNames} را برای ${dateTime} رزرو کرد.`,
          icon: '/logo/logo-512.png',
          data: { 
            url: `/dashboard/appointments`,
            appointmentId: appointment.id,
          },
        });
      } catch (pushError) {
        console.error('⚠️ Failed to send push notification to ADMIN:', pushError.message);
      }

      // Send to assigned employee
      if (appointment.employeeId && appointment.employee?.userId) {
        const employeeTitle = 'نوبت جدید ثبت شد';
        const employeeMessage = 'یک نوبت جدید ثبت شده و منتظر تایید شماست.';

        const empNotification = await this.notificationsService.create({
          title: employeeTitle,
          message: employeeMessage,
          type: 'APPOINTMENT_CREATED',
          userIdTarget: appointment.employee.userId,
          relatedEntity: `appointment:${appointment.id}`,
        });

        this.notificationsGateway.sendToUser(appointment.employee.userId, empNotification);

        try {
          await this.pushNotificationsService.sendToUser(appointment.employee.userId, {
            title: employeeTitle,
            body: employeeMessage,
            icon: '/logo/logo-512.png',
            data: {
              url: `/dashboard/appointments`,
              appointmentId: appointment.id,
            },
          });
        } catch (pushError) {
          console.error('⚠️ Failed to send push notification to employee:', pushError.message);
        }
      }

      // Notify the customer (in-app + websocket + push)
      if (appointment.customer?.userId) {
        const custTitle = 'نوبت شما ثبت شد';
        const custMessage = 'نوبت شما با موفقیت ثبت شد.';

        const custNotification = await this.notificationsService.create({
          title: custTitle,
          message: custMessage,
          type: 'APPOINTMENT_CREATED',
          userIdTarget: appointment.customer.userId,
          relatedEntity: `appointment:${appointment.id}`,
        });

        this.notificationsGateway.sendToUser(appointment.customer.userId, custNotification);

        try {
          await this.pushNotificationsService.sendToUser(appointment.customer.userId, {
            title: custTitle,
            body: custMessage,
            icon: '/logo/logo-512.png',
            data: {
              url: `/dashboard/appointments`,
              appointmentId: appointment.id,
            },
          });
        } catch (pushError) {
          console.error('⚠️ Failed to send push notification to customer:', pushError.message);
        }
      }
    } catch (error) {
      console.error('❌ Error sending appointment created notification:', error);
    }
  }

  /**
   * Helper: Send notification for appointment confirmed
   */
  private async notifyAppointmentConfirmed(appointment: any) {
    try {
      // Notify customer
      if (appointment.customer?.userId) {
        const customerTitle = 'نوبت شما تایید شد';
        const customerMessage = 'نوبت شما تایید شد.';

        const notification = await this.notificationsService.create({
          title: customerTitle,
          message: customerMessage,
          type: 'APPOINTMENT_CONFIRMED',
          userIdTarget: appointment.customer.userId,
          relatedEntity: `appointment:${appointment.id}`,
        });

        this.notificationsGateway.sendToUser(appointment.customer.userId, notification);

        try {
          await this.pushNotificationsService.sendToUser(appointment.customer.userId, {
            title: customerTitle,
            body: customerMessage,
            icon: '/logo/logo-512.png',
            data: {
              url: `/dashboard/appointments`,
              appointmentId: appointment.id,
            },
          });
        } catch (pushError) {
          console.error('⚠️ Failed to send confirmation push notification to customer:', pushError.message);
        }
      }

      // Notify admin
      const adminNotification = await this.notificationsService.create({
        title: 'نوبت تأیید شد',
        message: `نوبت ${appointment.customer?.user?.name} توسط ${appointment.employee?.user?.name} تأیید شد.`,
        type: 'APPOINTMENT_CONFIRMED',
        roleTarget: 'ADMIN',
        relatedEntity: `appointment:${appointment.id}`,
      });

      this.notificationsGateway.sendToRole('ADMIN', adminNotification);
    } catch (error) {
      console.error('❌ Error sending appointment confirmed notification:', error);
    }
  }

  /**
   * Post-commit in-app + Web Push for settlement. Soft-fail; never throws into checkout.
   * Barber copy uses snapshot gross/net (not payroll 40%/special split). SMS is not sent.
   */
  private async notifyAppointmentSettled(appointment: any, amount: number, _tipAmount: number) {
    try {
      const { grossToman, netToman } = resolveSettlementToman(appointment, amount);
      const grossLabel = formatFaAmount(grossToman);

      if (appointment.customer?.userId) {
        const customerTitle = 'نوبت تسویه شد';
        const customerMessage = `نوبت شما با مبلغ ${grossLabel} تومان تسویه شد. سپاس از انتخاب شما! 🌟`;
        const notification = await this.notificationsService.create({
          title: customerTitle,
          message: customerMessage,
          type: NotificationType.APPOINTMENT_SETTLED,
          userIdTarget: appointment.customer.userId,
          relatedEntity: `appointment:${appointment.id}`,
        });
        this.notificationsGateway.sendToUser(appointment.customer.userId, notification);
        try {
          await this.pushNotificationsService.sendToUser(appointment.customer.userId, {
            title: customerTitle,
            body: customerMessage,
            icon: '/logo/logo-512.png',
            data: {
              url: '/dashboard/appointments',
              appointmentId: appointment.id,
            },
          });
        } catch (pushError: any) {
          console.error(
            '⚠️ Failed to send settlement push to customer:',
            pushError?.message || pushError,
          );
        }
      }

      const barberUserId = appointment.employee?.userId;
      const employeeId = appointment.employeeId;
      if (barberUserId && employeeId) {
        const { relatedEntity } = settlementBarberNotifyKeys(
          appointment.id,
          employeeId,
        );
        const existing = await this.prisma.notification.findFirst({
          where: { relatedEntity, userIdTarget: barberUserId },
        });
        if (!existing) {
          const barberTitle = 'تسویه نوبت انجام شد';
          const barberMessage = formatBarberSettlementMessage(appointment.id, netToman);
          const notification = await this.notificationsService.create({
            title: barberTitle,
            message: barberMessage,
            type: NotificationType.APPOINTMENT_SETTLED,
            userIdTarget: barberUserId,
            relatedEntity,
          });
          this.notificationsGateway.sendToUser(barberUserId, notification);
          try {
            await this.pushNotificationsService.sendToUser(barberUserId, {
              title: barberTitle,
              body: barberMessage,
              icon: '/logo/logo-512.png',
              data: {
                url: '/dashboard/employee/salary-request',
                relatedEntity,
              },
            });
          } catch (pushError: any) {
            console.error(
              '⚠️ Failed to send settlement push to barber:',
              pushError?.message || pushError,
            );
          }
        }

        // [REQ-1] settlement SMS intentionally disabled — in-app & Web Push only.
        // Admin can re-enable in future via sms_notification_rules (not by resurrecting this call).
      }
    } catch (error) {
      console.error('❌ Error sending appointment settled notification:', error);
    }
  }

  /**
   * Helper: Send notification for appointment cancelled
   */
  private async notifyAppointmentCancelled(appointment: any) {
    try {
      // Notify customer
      if (appointment.customer?.userId) {
        const notification = await this.notificationsService.create({
          title: 'نوبت لغو شد',
          message: `نوبت شما لغو گردید. برای رزرو مجدد با ما تماس بگیرید.`,
          type: 'APPOINTMENT_CANCELLED',
          userIdTarget: appointment.customer.userId,
          relatedEntity: `appointment:${appointment.id}`,
        });

        this.notificationsGateway.sendToUser(appointment.customer.userId, notification);
      }

      // Notify employee
      if (appointment.employee?.userId) {
        const notification = await this.notificationsService.create({
          title: 'نوبت لغو شد',
          message: `نوبت ${appointment.customer?.user?.name} لغو شد.`,
          type: 'APPOINTMENT_CANCELLED',
          userIdTarget: appointment.employee.userId,
          relatedEntity: `appointment:${appointment.id}`,
        });

        this.notificationsGateway.sendToUser(appointment.employee.userId, notification);
      }

      // Notify admin
      const adminNotification = await this.notificationsService.create({
        title: 'نوبت لغو شد',
        message: `نوبت ${appointment.customer?.user?.name} لغو شد.`,
        type: 'APPOINTMENT_CANCELLED',
        roleTarget: 'ADMIN',
        relatedEntity: `appointment:${appointment.id}`,
      });

      this.notificationsGateway.sendToRole('ADMIN', adminNotification);
    } catch (error) {
      console.error('❌ Error sending appointment cancelled notification:', error);
    }
  }

  private async assertEligibleServiceStaff(
    tx: Prisma.TransactionClient,
    employeeId: number,
  ) {
    const emp = await tx.employee.findUnique({
      where: { id: employeeId },
      include: { user: { select: { role: true } } },
    });
    if (!emp || !emp.isActive) {
      throw new BadRequestException('پرسنل خدمات انتخاب‌شده فعال نیست');
    }
    if (emp.user?.role !== 'SERVICE') {
      throw new BadRequestException(
        'فقط پرسنل خدمات می‌توانند گیرنده انعام باشند؛ آرایشگر قابل انتخاب نیست',
      );
    }
    return emp;
  }

  private async findActiveServiceStaffIds(
    tx: Prisma.TransactionClient,
  ): Promise<number[]> {
    const rows = await tx.employee.findMany({
      where: { isActive: true, user: { role: 'SERVICE' } },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    return rows.map((r) => r.id);
  }

  /**
   * Daily tip stats from settled appointments (replaces legacy accounting/tips/daily-stats).
   * Date bounds use Asia/Tehran half-open day (same civil-day convention as slot grid).
   */
  async getDailyTipStats(dateStr: string) {
    const { gregorianYmdToTehranHalfOpenDay } = await import(
      '../common/utils/tehran-business-day'
    );
    const range = gregorianYmdToTehranHalfOpenDay(dateStr);
    if (!range) {
      throw new BadRequestException('فرمت تاریخ نامعتبر است (YYYY-MM-DD)');
    }
    const { start: startOfDay, endExclusive: endOfDay } = range;

    const appointments = await this.prisma.appointment.findMany({
      where: {
        deletedAt: null,
        paidAt: { gte: startOfDay, lt: endOfDay },
        tipAmount: { not: null, gt: 0n },
        status: { in: ['SETTLED', 'PAID', 'COMPLETED'] },
      },
      include: {
        customer: { include: { user: true } },
        employee: { include: { user: true } },
        tipRecipientEmployee: { include: { user: true } },
        tipAllocations: {
          include: {
            employee: { include: { user: { select: { name: true, role: true } } } },
          },
        },
      },
      orderBy: { paidAt: 'asc' },
    });

    let totalAmount = 0n;
    let staffShareTotal = 0n;
    let salonShareTotal = 0n;
    const transactions = appointments.map((apt) => {
      const amount = apt.tipAmount ?? 0n;
      totalAmount += amount;
      staffShareTotal += apt.tipStaffShareRial ?? 0n;
      salonShareTotal += apt.tipSalonShareRial ?? 0n;
      const shares = (apt.tipAllocations || []).map((a) => ({
        employeeId: a.employeeId,
        employeeName: a.employee?.user?.name ?? `کارمند #${a.employeeId}`,
        role: a.employee?.user?.role ?? null,
        amountRial: a.amountRial.toString(),
        amount: Number(a.amountRial),
      }));
      const recipientLabel =
        apt.tipRecipientType === 'TEAM'
          ? shares.length > 0
            ? `تیم (${shares.map((s) => s.employeeName).join('، ')})`
            : 'تیم خدمات'
          : apt.tipRecipientEmployee?.user?.name ?? '—';
      return {
        id: apt.id,
        amount: Number(amount),
        amountRial: amount.toString(),
        staffShare: apt.tipStaffShareRial ? Number(apt.tipStaffShareRial) : null,
        salonShare: apt.tipSalonShareRial ? Number(apt.tipSalonShareRial) : null,
        tipRecipientType: apt.tipRecipientType,
        tipTeamMemberIds: apt.tipTeamMemberIds ?? null,
        tipShares: shares,
        createdAt: apt.paidAt?.toISOString() ?? apt.updatedAt.toISOString(),
        customerName: apt.customer?.user?.name ?? '—',
        barberName: apt.employee?.user?.name ?? '—',
        tipRecipientName: recipientLabel,
        appointmentId: apt.id,
        description: apt.tipRecipientType
          ? `انعام ${apt.tipRecipientType === 'TEAM' ? 'تیمی' : 'فردی'}`
          : 'انعام (بدون تخصیص — داده قدیمی)',
      };
    });

    return {
      date: dateStr,
      totalAmount: Number(totalAmount),
      totalAmountRial: totalAmount.toString(),
      staffShareTotal: Number(staffShareTotal),
      salonShareTotal: Number(salonShareTotal),
      transactionCount: transactions.length,
      isDivided: transactions.some((t) => t.tipRecipientType != null),
      transactions,
    };
  }
}
