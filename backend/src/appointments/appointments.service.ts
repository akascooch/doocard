import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { 
  CreateAppointmentDto, 
  UpdateAppointmentDto,
  SettleAppointmentDto,
  GetSlotsDto,
  QueryAppointmentsDto,
  AppointmentServiceDto
} from './dto';
import { AccountingService } from '../accounting/accounting.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { CalendarService } from '../calendar/calendar.service';
import { FarazSmsSendService } from '../sms/faraz-sms-send.service';
import * as bcrypt from 'bcrypt';
import { normalizeAppointmentFields } from '../common/utils/appointment-response.util';

interface ServiceSnapshot {
  serviceId: number;
  priceAtBooking: number; // RIAL
  durationMin: number;
  serviceName?: string;
}

/** Slot grid and booking window (Asia/Tehran business hours). */
const SLOT_INTERVAL_MIN = 30;
const BOOKING_DURATION_MIN = 60;
const BUSINESS_HOUR_START = 10;
const BUSINESS_HOUR_END = 22;

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
    private farazSmsSendService: FarazSmsSendService,
  ) {}

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
    console.log('📅 Creating appointment (reserving slot):', dto);

    // Parse date input (jalaliDate + time OR scheduledAt)
    let scheduledAt: Date;
    let calendarDateId: number | undefined;

    if (dto.jalaliDate && dto.time) {
      // Parse Jalali date + time (Iran timezone: UTC+3:30)
      const gregorianDate = this.calendarService.toGregorian(dto.jalaliDate);
      const [hours, minutes] = dto.time.split(':').map(Number);

      if (minutes % SLOT_INTERVAL_MIN !== 0) {
        throw new BadRequestException(
          `زمان نوبت باید در بازه‌های ${SLOT_INTERVAL_MIN} دقیقه‌ای باشد (مثلاً 14:00 یا 14:30)`,
        );
      }
      
      // Convert Iran local time to UTC using ISO 8601 with timezone offset
      // Iran is UTC+3:30
      const year = gregorianDate.getFullYear();
      const month = String(gregorianDate.getMonth() + 1).padStart(2, '0');
      const day = String(gregorianDate.getDate()).padStart(2, '0');
      const hourStr = String(hours).padStart(2, '0');
      const minStr = String(minutes).padStart(2, '0');
      
      // Create ISO 8601 string with Iran timezone offset (+03:30)
      const isoWithTZ = `${year}-${month}-${day}T${hourStr}:${minStr}:00+03:30`;
      scheduledAt = new Date(isoWithTZ);

      // Get calendar_date_id
      const calendarDate = await this.calendarService.ensureExists({ jalaliDate: dto.jalaliDate });
      calendarDateId = calendarDate.id;
      
      console.log(`📅 Parsed Jalali: ${dto.jalaliDate} ${dto.time} (Iran/UTC+3:30) → ${scheduledAt.toISOString()} (UTC) (calendar_date_id: ${calendarDateId})`);
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
      
      console.log(`📅 Parsed ISO: ${dto.scheduledAt} → ${scheduledAt.toISOString()} (calendar_date_id: ${calendarDateId})`);
    } else {
      throw new BadRequestException('Either (jalaliDate + time) or scheduledAt must be provided');
    }

    // Min 2h rule (deterministic): same calendar day in Tehran; comparison in UTC.
    const nowUtc = new Date();
    const todayTehran = nowUtc.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
    const bookingDateTehran = scheduledAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });

    const isCustomer = currentUser?.role === 'CUSTOMER';
    const isStaff = currentUser?.role === 'ADMIN' || currentUser?.role === 'EMPLOYEE';

    // [TZ-VALIDATE STEP 4] Midnight boundary (no logic change)
    const nowTehranStr = nowUtc.toLocaleString('en-US', { timeZone: 'Asia/Tehran' });
    const selectedTehranStr = scheduledAt.toLocaleString('en-US', { timeZone: 'Asia/Tehran' });
    console.log('[TZ-VALIDATE midnight] nowTehran:', nowTehranStr, '| selectedTehran:', selectedTehranStr, '| isToday:', bookingDateTehran === todayTehran);

    /*
     * Customer bookings require a 2-hour minimum lead time.
     * Staff (ADMIN / EMPLOYEE) can register past times for operational reasons
     * such as back-office appointment registration.
     * Unauthenticated callers are treated like customers.
     */
    if (bookingDateTehran === todayTehran && !isStaff) {
      const minAllowedAtUtc = new Date(nowUtc.getTime() + 2 * 60 * 60 * 1000);
      // [TZ-VALIDATE STEP 3] 2h rule (no logic change)
      console.log('[TZ-VALIDATE 2h] nowUtc:', nowUtc.toISOString());
      console.log('[TZ-VALIDATE 2h] minAllowedAtUtc:', minAllowedAtUtc.toISOString());
      console.log('[TZ-VALIDATE 2h] selectedStartUtc (scheduledAt):', scheduledAt.toISOString());
      console.log('[TZ-VALIDATE 2h] scheduledAt < minAllowedAtUtc:', scheduledAt < minAllowedAtUtc, '→', scheduledAt < minAllowedAtUtc ? 'FAIL' : 'PASS');
      if (scheduledAt < minAllowedAtUtc) {
        throw new BadRequestException('نوبت باید حداقل ۲ ساعت قبل از زمان نوبت ثبت شود');
      }
    } else if (bookingDateTehran === todayTehran && isStaff) {
      console.log('[BOOKING] Staff same-day create: 2h lead-time rule skipped for', currentUser?.role);
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
        include: { employeeServices: { include: { service: true } } },
      });

      if (!employee) {
        throw new NotFoundException(`Employee with ID ${dto.employeeId} not found`);
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
    
    console.log(`⏱️ Duration calculation: services=${dto.services.length}, totalDuration=${totalDuration}min, finalDuration=${finalDuration}min`);
    const endAt = new Date(scheduledAt.getTime() + finalDuration * 60 * 1000);

    // ATOMIC RESERVATION with PostgreSQL advisory lock
    return this.prisma.$transaction(async (tx) => {
      if (dto.employeeId) {
        // Acquire advisory lock for this employee (concurrent-safe)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(CONCAT('employee:', ${dto.employeeId}::text)))`;

        console.log(`🔒 Acquired lock for employee ${dto.employeeId}`);

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
            console.log('❌ Overlap detected with appointment:', overlapping.id);
            console.log(`   - Existing: ${overlapping.scheduledAt.toISOString()} (${overlapping.durationMin}min, ${overlapping.status})`);
            console.log(`   - Requested: ${scheduledAt.toISOString()} (${dto.services.reduce((sum, s) => sum + s.durationMin, 0)}min)`);
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
          console.log('❌ Blocked time detected:', blockedTime.reason);
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
      const appointment = await tx.appointment.create({
        data: {
          customerId: dto.customerId,
          employeeId: dto.employeeId || null,
          calendarDateId, // Add calendar reference
          services: servicesSnapshot as any,
          scheduledAt,
          durationMin: finalDuration,
          status: initialStatus,
          notes: dto.notes,
        },
        include: {
          customer: { include: { user: true } },
          employee: { include: { user: true } },
          calendarDate: true, // Include calendar info
        },
      });

      console.log('✅ Appointment created (slot reserved):', appointment.id);
      
      // In-app + push notification
      await this.notifyAppointmentCreated(appointment);
      
      // SMS via FarazSMS (IPPANEL Edge): customer + employee only. Failure must not break creation.
      await this.sendAppointmentCreatedSms(appointment);
      
      return this.formatAppointment(appointment);
    });
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

    const customerMessage = `دوکاردی عزیز 💈

نوبت شما با موفقیت ثبت شد و در انتظار تایید آرایشگر است.

🧑‍🔧 آرایشگر: ${employeeName}
🗓 تاریخ: ${jalaliDate}
⏰ ساعت: ${time}
✂️ خدمات: ${serviceNames}

پس از تایید، پیامک نهایی برای شما ارسال خواهد شد.`;

    const barberMessage = `دوکاردی عزیز 💈

یک نوبت جدید ثبت شده و نیاز به تایید شما دارد.

👤 مشتری: ${customerName}
🗓 تاریخ: ${jalaliDate}
⏰ ساعت: ${time}
✂️ خدمات: ${serviceNames}

لطفاً در پنل مدیریت آن را تایید یا لغو کنید.`;

    const customerPhone = appointment.customer?.user?.phone;
    if (customerPhone) {
      try {
        const result = await this.farazSmsSendService.sendSingle(customerPhone, customerMessage);
        if (!result.success) {
          console.error(`[SMS] Customer notification failed for appointment ${appointment.id}: ${result.error}`);
        }
      } catch (e) {
        console.warn(`[SMS] Customer SMS failed but flow continues for appointment ${appointment.id}:`, e?.message || e);
      }
    }

    const employeePhone = appointment.employee?.user?.phone;
    if (employeePhone) {
      try {
        const result = await this.farazSmsSendService.sendSingle(employeePhone, barberMessage);
        if (!result.success) {
          console.error(`[SMS] Employee notification failed for appointment ${appointment.id}: ${result.error}`);
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
    const message = `دوکاردی عزیز 💈

نوبت شما تایید شد ✅

🧑‍🔧 آرایشگر: ${employeeName}
🗓 تاریخ: ${jalaliDate}
⏰ ساعت: ${time}
✂️ خدمات: ${serviceNames}

منتظر دیدار شما هستیم 🌟`;
    try {
      const result = await this.farazSmsSendService.sendSingle(customerPhone, message);
      if (!result.success) {
        console.error(`[SMS] Confirmed notification failed for appointment ${appointment.id}: ${result.error}`);
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
    const message = `دوکاردی عزیز 💈

متأسفانه نوبت شما لغو شد ❌

🧑‍🔧 آرایشگر: ${employeeName}
🗓 تاریخ: ${jalaliDate}
⏰ ساعت: ${time}

از آرایشگاه با شما تماس گرفته می‌شود برای هماهنگی نوبت جدید.`;
    try {
      const result = await this.farazSmsSendService.sendSingle(customerPhone, message);
      if (!result.success) {
        console.error(`[SMS] Cancelled notification failed for appointment ${appointment.id}: ${result.error}`);
      }
    } catch (e) {
      console.warn(`[SMS] Cancelled SMS failed but flow continues for appointment ${appointment.id}:`, e?.message || e);
    }
  }

  /**
   * Get appointments with filters
   */
  async findAll(query: QueryAppointmentsDto, currentUser?: any) {
    console.log('🔍 Finding appointments with query:', query, 'user:', currentUser?.role);

    const where: any = {
      deletedAt: null, // Exclude soft-deleted
    };

    // Role-based filtering
    if (currentUser) {
      if (currentUser.role === 'CUSTOMER') {
        /**
         * SECURITY FIX: fail-closed — customers must never see unscoped appointment data.
         */
        const customer = await this.prisma.customer.findUnique({
          where: { userId: currentUser.id },
        });

        if (!customer) {
          throw new ForbiddenException('Customer profile not found');
        }

        where.customerId = customer.id;
      } else if (currentUser.role === 'EMPLOYEE') {
        const employee = await this.prisma.employee.findUnique({
          where: { userId: currentUser.sub || currentUser.id },
        });
        if (employee) {
          where.employeeId = employee.id;
        }
      }
      // ADMIN sees all
    }

    // Query filters
    if (query.customerId) where.customerId = query.customerId;
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;

    if (query.from || query.to) {
      where.scheduledAt = {};
      if (query.from) where.scheduledAt.gte = new Date(query.from);
      if (query.to) where.scheduledAt.lte = new Date(query.to);
    }

    // Search by customer name/phone
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

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: {
        customer: { include: { user: true } },
        employee: { include: { user: true } },
        service: true,
        paidByUser: { select: { id: true, name: true } },
        calendarDate: true, // Include calendar info
      },
      orderBy: { scheduledAt: 'desc' },
      skip: query.skip || 0,
      take: query.take || 200, // Increased default from 50 to 200
    });

    const count = await this.prisma.appointment.count({ where });

    return {
      data: appointments.map(a => this.formatAppointment(a)),
      total: count,
      skip: query.skip || 0,
      take: query.take || 200, // Increased default from 50 to 200
    };
  }

  /**
   * Find one appointment by ID
   */
  async findOne(id: number) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: { include: { user: true } },
        employee: { include: { user: true } },
        paidByUser: { select: { id: true, name: true } },
        transactions: true,
        calendarDate: true, // Include calendar info
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    return this.formatAppointment(appointment);
  }

  /**
   * Update appointment
   */
  async update(id: number, dto: UpdateAppointmentDto) {
    const existing = await this.findOne(id);

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
  async remove(id: number) {
    const appointment = await this.findOne(id);

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
    console.log('[TZ-VALIDATE] Server ISO:', new Date().toISOString());
    console.log('[TZ-VALIDATE] Server TZ:', Intl.DateTimeFormat().resolvedOptions().timeZone);

    console.log('🕐 Getting available slots (10:00–22:00 Asia/Tehran):', dto);

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
    const dbWeekdayQueried = targetDate.getUTCDay();
    const calendarEntry = await this.calendarService.getByGregorian(targetDate);
    const jalaliWeekdayFromCalendar = calendarEntry?.jalaliDayOfWeek ?? null;

    console.log('[WEEKDAY-DEBUG]', {
      requestedDate: date.slice(0, 10),
      gregorianWeekdayTehran: dbWeekdayQueried,
      jalaliWeekday: jalaliWeekdayFromCalendar,
      dbWeekdayQueried,
    });

    const weekday = dbWeekdayQueried;

    // Asia/Tehran: UTC+3:30. Midnight Tehran for this Gregorian day = UTC midnight minus 3.5h.
    const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;
    const utcMidnightThatDay = Date.UTC(gy, gm, gd, 0, 0, 0, 0);
    const tehranMidnightUtc = new Date(utcMidnightThatDay - TEHRAN_OFFSET_MS);
    const tehranDayEndUtc = new Date(tehranMidnightUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

    // Query range: full Tehran day (so we see all appointments on that day)
    const startOfDay = tehranMidnightUtc;
    const endOfDay = tehranDayEndUtc;

    console.log(`📅 Tehran day range (UTC): ${startOfDay.toISOString()} → ${endOfDay.toISOString()}, weekday (0=Sun..6=Sat): ${weekday}`);

    // Get work schedule for this weekday (0=Sunday .. 6=Saturday, matches schema)
    const workSchedules = await this.prisma.workSchedule.findMany({
      where: {
        employeeId,
        weekday,
        isActive: true,
      },
      orderBy: { startTime: 'asc' },
    });

    console.log(`📅 Work schedules for weekday ${weekday}:`, workSchedules);

    // Runtime fallback when no work_schedules row exists for this weekday (do not insert into DB)
    if (workSchedules.length === 0) {
      console.warn('[WORKSCHEDULE-FALLBACK]', {
        employeeId,
        weekday: dbWeekdayQueried,
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
    console.log('[TZ-VALIDATE] selectedDate:', date);
    console.log('[TZ-VALIDATE] tehranMidnightUtc:', tehranMidnightUtc.toISOString());
    console.log('[TZ-VALIDATE] windowStartUtc:', windowStartUtc.toISOString());
    console.log('[TZ-VALIDATE] windowEndUtc:', windowEndUtc.toISOString());

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
    
    console.log(`📋 Found ${existingAppointments.length} appointments for employee ${employeeId} on ${date}:`);
    existingAppointments.forEach(apt => {
      console.log(`   - ID ${apt.id}: ${apt.scheduledAt.toISOString()} (${apt.durationMin}min, ${apt.status})`);
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

    console.log(`📋 Found ${existingAppointments.length} appointments, ${blockedTimes.length} blocked times`);

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

    console.log(`✅ Generated ${availableSlots.length} available slots (including work schedule and blocked times)`);

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

    // [TZ-VALIDATE] Temporary slot validation logs (booking window + 2h rule)
    const { nowUtc, dateStr: todayTehran, timeStr: nowTehran } = this.getTehranNow();
    const minAllowedUtc = new Date(nowUtc.getTime() + 2 * 60 * 60 * 1000);
    const dayStartUtc = tehranMidnightUtc;
    const firstGeneratedSlot = allSlots[0]?.time ?? null;
    console.log('[TZ-VALIDATE] nowUtc:', nowUtc.toISOString());
    console.log('[TZ-VALIDATE] nowTehran:', nowTehran);
    console.log('[TZ-VALIDATE] minAllowedUtc:', minAllowedUtc.toISOString());
    console.log('[TZ-VALIDATE] dayStartUtc (tehranMidnightUtc):', dayStartUtc.toISOString());
    console.log('[TZ-VALIDATE] firstGeneratedSlot:', firstGeneratedSlot);

    // Min 2h rule: apply ONLY for today (Asia/Tehran). Block slots whose start is in the next 2h (absolute time).
    const requestedDate = date.slice(0, 10); // YYYY-MM-DD (normalize if ISO)
    console.log('[MIN2H-DEBUG]', {
      requestedDate,
      todayTehran,
      isSameDay: requestedDate === todayTehran,
      typeofRequested: typeof requestedDate,
      typeofToday: typeof todayTehran,
    });
    console.log('[MIN2H-DEBUG-TYPES]', {
      requestedDateValue: requestedDate,
      requestedDateISO: new Date(requestedDate).toISOString(),
      todayTehranISO: new Date(todayTehran).toISOString(),
    });
    if (requestedDate === todayTehran && !isStaff) {
      const minGapMinutes = 2 * 60; // 2 hours in minutes
      for (const slot of allSlots) {
        const gapMinutes = (new Date(slot.time).getTime() - nowUtc.getTime()) / 60000;
        if (gapMinutes >= 0 && gapMinutes < minGapMinutes && slot.available) {
          slot.available = false;
          slot.reason = 'min_2h';
        }
      }
    }
    const firstValidSlotAfter2h = allSlots.find(s => s.available)?.time ?? null;
    console.log('[TZ-VALIDATE] firstValidSlotAfter2h:', firstValidSlotAfter2h);

    // If requestedDate !== todayTehran: do not apply min_2h at all.

    const availableCount = allSlots.filter(s => s.available).length;
    const busyCount = allSlots.filter(s => !s.available).length;
    const busySlots = allSlots.filter(s => !s.available);

    console.log(`✅ Generated ${allSlots.length} total slots: ${availableCount} available, ${busyCount} busy`);
    
    if (busySlots.length > 0) {
      console.log(`🔴 Busy slots:`);
      busySlots.forEach(slot => {
        console.log(`   - ${slot.displayTime}: ${slot.reason}`);
      });
    }

    const firstAvailableSlot = allSlots.find(s => s.available)?.time ?? null;

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

    const { nowUtc, dateStr: todayTehranStr, timeStr: tehranTimeStr } = this.getTehranNow();
    console.log('[Earliest] Server now (ISO):', nowUtc.toISOString());
    console.log('[Earliest] Tehran now (date/time):', todayTehranStr, tehranTimeStr);
    console.log('[Earliest] Base Tehran date for earliest search:', todayTehranStr);

    const durationMin = BOOKING_DURATION_MIN;

    const addDaysToGregorian = (dateStr: string, days: number): string => {
      const d = new Date(dateStr + 'T12:00:00.000Z');
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };

    for (let i = 0; i < 30; i++) {
      const dateStr = addDaysToGregorian(todayTehranStr, i);
      console.log('[Earliest] Offset:', i);
      console.log('[Earliest] Date checked:', dateStr);

      const result = await this.getAvailableSlots({
        employeeId,
        date: dateStr,
        durationMin,
        slotIntervalMin: SLOT_INTERVAL_MIN,
      });

      const totalSlots = result.slots.length;
      const availableSlots = result.slots.filter((s) => s.available).length;
      console.log('[Earliest] Available slots count:', availableSlots);
      const first = result.slots.find((s) => s.available);
      console.log('[Earliest] First slot time:', first?.time ?? null);

      if (first) {
        const gregorianDate = new Date(dateStr + 'T12:00:00.000Z');
        const jalaliDate = this.calendarService.toJalali(gregorianDate);
        console.log(`✅ Earliest slot found: ${dateStr} ${first.displayTime} (Jalali: ${jalaliDate})`);
        return {
          date: dateStr,
          jalaliDate,
          time: first.time,
          displayTime: first.displayTime,
          endTime: first.endTime,
        };
      }
    }

    console.log('⚠️ No available slot in next 30 days for employee', employeeId, 'service', serviceId);
    throw new NotFoundException({ message: 'NO_AVAILABLE_SLOT' });
  }

  /**
   * Settle appointment (ADMIN only)
   * Creates accounting transactions and handles debt if needed
   */
  async settle(id: number, dto: SettleAppointmentDto, adminUser: any) {
    console.log('💰 Settling appointment:', id, dto, 'by admin:', adminUser.phone);

    const appointment = await this.findOne(id);

    if (appointment.status === 'SETTLED' || appointment.status === 'PAID') {
      throw new BadRequestException('این نوبت قبلاً تسویه شده است');
    }

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('نمی‌توان نوبت لغو شده را تسویه کرد');
    }

    // Validate account for non-DEBT payments
    if (dto.paymentMethod !== 'DEBT' && !dto.accountId) {
      throw new BadRequestException('حساب بانکی برای روش پرداخت الزامی است');
    }

    // Check for duplicate settlement (idempotency)
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
        console.log('⚠️  Duplicate settlement detected, returning existing');
        return this.findOne(id);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Update appointment
      const updated = await tx.appointment.update({
        where: { id },
        data: {
          amount: BigInt(dto.amount),
          tipAmount: dto.tipAmount ? BigInt(dto.tipAmount) : null,
          paymentMethod: dto.paymentMethod,
          accountId: dto.accountId || null,
          paidAt: new Date(),
          paidBy: adminUser.sub || adminUser.id,
          status: 'SETTLED',
          notes: dto.notes ? `${appointment.notes || ''}\n${dto.notes}` : appointment.notes,
        },
        include: {
          customer: { include: { user: true } },
          employee: { include: { user: true } },
          paidByUser: { select: { id: true, name: true } },
        },
      });

      const meta = {
        appointmentId: id,
        employeeId: appointment.employeeId,
        customerId: appointment.customerId,
        adminId: adminUser.sub || adminUser.id,
        externalRef: dto.externalRef,
      };

      // Handle payment based on method
      if (dto.paymentMethod === 'DEBT') {
        // Create CustomerDebt record
        await tx.customerDebt.create({
          data: {
            customerId: appointment.customerId,
            amount: BigInt(dto.amount),
            sourceType: 'APPOINTMENT',
            sourceId: id,
            description: `بدهی نوبت #${id}`,
            meta: meta as any,
          },
        });

        console.log('📝 Created CustomerDebt for amount:', dto.amount);

        // TODO: Send notification to customer about debt
        // this.notificationService.notifyCustomerDebt(...)
      } else {
        // Create INCOME transaction for appointment
        await tx.transaction.create({
          data: {
            type: 'INCOME',
            amount: BigInt(dto.amount),
            description: `درآمد نوبت #${id}`,
            sourceType: 'APPOINTMENT',
            sourceId: id,
            accountId: dto.accountId,
            paymentMethod: dto.paymentMethod,
            occurredAt: new Date(),
            createdBy: adminUser.sub || adminUser.id,
            meta: meta as any,
          },
        });

        // Update bank account balance
        if (dto.accountId) {
          await tx.bankAccount.update({
            where: { id: dto.accountId },
            data: { balance: { increment: BigInt(dto.amount) } },
          });
        }

        console.log('💵 Created INCOME transaction for amount:', dto.amount);

        // Create TIP transaction if tip provided
        if (dto.tipAmount && dto.tipAmount > 0) {
          await tx.transaction.create({
            data: {
              type: 'INCOME',
              amount: BigInt(dto.tipAmount),
              description: `انعام نوبت #${id}`,
              sourceType: 'TIP',
              sourceId: id,
              accountId: dto.accountId,
              paymentMethod: dto.paymentMethod,
              occurredAt: new Date(),
              createdBy: adminUser.sub || adminUser.id,
              meta: { ...meta, isTip: true } as any,
            },
          });

          // Update bank account balance for tip
          if (dto.accountId) {
            await tx.bankAccount.update({
              where: { id: dto.accountId },
              data: { balance: { increment: BigInt(dto.tipAmount) } },
            });
          }

          console.log('💵 Created TIP transaction for amount:', dto.tipAmount);
        }
      }

      console.log('✅ Appointment settled successfully');
      
      // Send notification
      await this.notifyAppointmentSettled(updated, dto.amount, dto.tipAmount || 0);
      
      return this.formatAppointment(updated);
    });
  }

  /**
   * Revert settlement (ADMIN only). Undo settlement so appointment can be deleted.
   * Soft-deletes related transactions, restores bank balance, removes CustomerDebt, clears appointment financial fields.
   */
  async revertSettlement(id: number, adminUser: any) {
    console.log('↩️ Reverting settlement for appointment:', id, 'by admin:', adminUser?.phone);

    const appointment = await this.findOne(id);

    if (appointment.status !== 'SETTLED' && appointment.status !== 'PAID') {
      throw new BadRequestException('فقط نوبت‌های تسویه شده قابل برگشت از تسویه هستند');
    }

    return this.prisma.$transaction(async (tx) => {
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

      console.log(`↩️ Found ${transactions.length} transaction(s) to revert for appointment ${id}`);

      for (const txn of transactions) {
        if (txn.accountId != null) {
          await tx.bankAccount.update({
            where: { id: txn.accountId },
            data: { balance: { decrement: txn.amount } },
          });
          console.log(`↩️ Decremented account ${txn.accountId} by ${txn.amount}`);
        }
        await tx.transaction.update({
          where: { id: txn.id },
          data: { deletedAt: now },
        });
      }

      // D) Remove CustomerDebt linked to this appointment (if settled as DEBT)
      const deletedDebts = await tx.customerDebt.deleteMany({
        where: {
          sourceType: 'APPOINTMENT',
          sourceId: id,
        },
      });
      if (deletedDebts.count > 0) {
        console.log(`↩️ Deleted ${deletedDebts.count} CustomerDebt row(s) for appointment ${id}`);
      }

      // E) Clear appointment financial fields and set status to CONFIRMED
      await tx.appointment.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          amount: null,
          tipAmount: null,
          paymentMethod: null,
          accountId: null,
          paidAt: null,
          paidBy: null,
        },
      });

      console.log('✅ Revert settlement completed for appointment', id);
      return { message: 'Settlement reverted successfully' };
    });
  }

  /**
   * Cancel appointment
   */
  async cancel(id: number, currentUser: any) {
    const appointment = await this.findOne(id);

    // Permission check
    if (currentUser.role === 'CUSTOMER') {
      const customer = await this.prisma.customer.findUnique({
        where: { userId: currentUser.sub || currentUser.id },
      });
      if (customer?.id !== appointment.customerId) {
        throw new BadRequestException('شما فقط می‌توانید نوبت‌های خود را لغو کنید');
      }
    } else if (currentUser.role === 'EMPLOYEE') {
      const employee = await this.prisma.employee.findUnique({
        where: { userId: currentUser.sub || currentUser.id },
      });
      if (employee?.id !== appointment.employeeId) {
        throw new BadRequestException('شما فقط می‌توانید نوبت‌های خود را لغو کنید');
      }
    }

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

    // SMS (non-blocking)
    try {
      await this.sendAppointmentCancelledSms(updated);
    } catch (e) {
      console.warn('[SMS] Cancelled SMS failed but flow continues:', e?.message || e);
    }

    return this.formatAppointment(updated);
  }

  /**
   * Confirm appointment with revalidation and alternatives
   * (EMPLOYEE/ADMIN only) - change status from PENDING_CONFIRMATION to CONFIRMED
   */
  async confirm(id: number, currentUser: any) {
    console.log('✅ Confirming appointment:', id, 'by user:', currentUser.phone);

    const appointment = await this.findOne(id);

    if (appointment.status !== 'PENDING_CONFIRMATION' && appointment.status !== 'PENDING') {
      throw new BadRequestException('فقط نوبت‌های در انتظار تایید قابل تایید هستند');
    }

    // Re-validate with atomic lock
    return this.prisma.$transaction(async (tx) => {
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
            console.log('❌ Conflict detected during confirmation');
            
            // Get suggestions for alternative slots
            const dateStr = scheduledAt.toISOString().split('T')[0];
            const suggestions = await this.getAvailableSlots({
              employeeId: appointment.employeeId,
              date: dateStr,
              durationMin: appointment.durationMin,
            });

            throw new BadRequestException({
              statusCode: 409,
              message: 'تداخل زمانی! این زمان دیگر رزرو شده است',
              error: 'SLOT_CONFLICT',
              suggestions: suggestions.slots.slice(0, 3), // Return 3 nearest alternatives
            });
          }
        }
      }

      // Confirm appointment
      const updated = await tx.appointment.update({
        where: { id },
        data: { status: 'CONFIRMED' },
        include: {
          customer: { include: { user: true } },
          employee: { include: { user: true } },
          calendarDate: true,
        },
      });

      console.log('✅ Appointment confirmed successfully');

      // Send notification
      await this.notifyAppointmentConfirmed(updated);

      // SMS (non-blocking)
      try {
        await this.sendAppointmentConfirmedSms(updated);
      } catch (e) {
        console.warn('[SMS] Confirm SMS failed but flow continues:', e?.message || e);
      }

      return this.formatAppointment(updated);
    });
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
    console.log('📅 Getting employee calendar:', { employeeId, fromDate, toDate });

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
    console.log('🚫 Creating blocked time:', data);

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

    console.log('✅ Blocked time created:', blockedTime.id);
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
        customer: { include: { user: true } },
        employee: { include: { user: true } },
        service: true,
        calendarDate: true,
      },
      orderBy: { scheduledAt: 'desc' },
    });

    return appointments.map((a) => this.formatAppointment(a));
  }

  private formatAppointment(appointment: any) {
    const services = appointment.services as ServiceSnapshot[];
    const normalized = normalizeAppointmentFields(appointment);
    
    // Calculate amounts in Rials (NO CONVERSION - display as is)
    const totalAmountRials = services?.reduce((sum, s) => sum + (s.priceAtBooking || 0), 0) || 0;
    const amountRials = appointment.amount ? Number(appointment.amount) : null;
    const tipAmountRials = appointment.tipAmount ? Number(appointment.tipAmount) : null;
    
    return {
      ...appointment,
      ...normalized,
      // Return amounts in RIALS (no Toman conversion)
      amount: amountRials, // RIAL
      tipAmount: tipAmountRials, // RIAL
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
          icon: '/logo/logo-192.png',
          data: { 
            url: `/dashboard/appointments`,
            appointmentId: appointment.id,
          },
        });
        console.log('✅ Push notification sent to ADMIN role');
      } catch (pushError) {
        console.error('⚠️ Failed to send push notification to ADMIN:', pushError.message);
      }

      // Send to assigned employee
      if (appointment.employeeId && appointment.employee?.userId) {
        const empNotification = await this.notificationsService.create({
          title: 'نوبت جدید برای شما',
          message: `مشتری ${appointment.customer?.user?.name} نوبت جدیدی برای ${dateTime} ثبت کرد.`,
          type: 'APPOINTMENT_CREATED',
          userIdTarget: appointment.employee.userId,
          relatedEntity: `appointment:${appointment.id}`,
        });

        this.notificationsGateway.sendToUser(appointment.employee.userId, empNotification);

        // 🔔 Send Push Notification to Employee
        try {
          await this.pushNotificationsService.sendToUser(appointment.employee.userId, {
            title: 'نوبت جدید برای شما',
            body: `مشتری ${appointment.customer?.user?.name} نوبت جدیدی برای ${dateTime} ثبت کرد.`,
            icon: '/logo/logo-192.png',
            data: { 
              url: `/dashboard/appointments`,
              appointmentId: appointment.id,
            },
          });
          console.log('✅ Push notification sent to employee:', appointment.employee.userId);
        } catch (pushError) {
          console.error('⚠️ Failed to send push notification to employee:', pushError.message);
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
        const notification = await this.notificationsService.create({
          title: 'نوبت شما تأیید شد',
          message: `آرایشگر ${appointment.employee?.user?.name || 'مربوطه'} نوبت شما را تأیید کرد.`,
          type: 'APPOINTMENT_CONFIRMED',
          userIdTarget: appointment.customer.userId,
          relatedEntity: `appointment:${appointment.id}`,
        });

        this.notificationsGateway.sendToUser(appointment.customer.userId, notification);
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
   * Helper: Send notification for appointment settled
   */
  private async notifyAppointmentSettled(appointment: any, amount: number, tipAmount: number) {
    try {
      const totalAmount = Math.floor(amount / 10); // Convert to Toman
      const formattedAmount = new Intl.NumberFormat('fa-IR').format(totalAmount);

      // Notify customer
      if (appointment.customer?.userId) {
        const notification = await this.notificationsService.create({
          title: 'نوبت تسویه شد',
          message: `نوبت شما با مبلغ ${formattedAmount} تومان تسویه شد. سپاس از انتخاب شما! 🌟`,
          type: 'APPOINTMENT_SETTLED',
          userIdTarget: appointment.customer.userId,
          relatedEntity: `appointment:${appointment.id}`,
        });

        this.notificationsGateway.sendToUser(appointment.customer.userId, notification);
      }

      // Notify employee
      if (appointment.employee?.userId) {
        const notification = await this.notificationsService.create({
          title: 'نوبت تسویه شد',
          message: `نوبت ${appointment.customer?.user?.name} با مبلغ ${formattedAmount} تومان تسویه شد.`,
          type: 'APPOINTMENT_SETTLED',
          userIdTarget: appointment.employee.userId,
          relatedEntity: `appointment:${appointment.id}`,
        });

        this.notificationsGateway.sendToUser(appointment.employee.userId, notification);
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
}
