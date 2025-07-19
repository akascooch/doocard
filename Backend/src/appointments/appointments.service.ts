import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentStatus } from '../common/enums';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AccountingService } from '../accounting/accounting.service';

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private accountingService: AccountingService,
  ) {}

  async findAll() {
    const appointments = await this.prisma.appointment.findMany({
      include: {
        customer: true,
        barber: true,
        services: { include: { service: true } },
      },
      orderBy: {
        date: 'desc',
      },
    });
    return appointments.map(apt => ({
      ...apt,
      services: apt.services.map(s => ({
        id: s.service.id,
        name: s.service.name,
        price: s.price,
      })),
    }));
  }

  async findOne(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        customer: true,
        barber: true,
        services: { include: { service: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    return {
      ...appointment,
      services: appointment.services.map(s => ({
        id: s.service.id,
        name: s.service.name,
        price: s.price,
      })),
    };
  }

  async findByBarber(barberId: number) {
    const appointments = await this.prisma.appointment.findMany({
      where: { barberId },
      include: {
        customer: true,
        barber: true,
        services: { include: { service: true } },
      },
      orderBy: {
        date: 'desc',
      },
    });
    return appointments.map(apt => ({
      ...apt,
      services: apt.services.map(s => ({
        id: s.service.id,
        name: s.service.name,
        price: s.price,
      })),
    }));
  }

  async findByCustomer(customerId: number) {
    const appointments = await this.prisma.appointment.findMany({
      where: { customerId },
      include: {
        customer: true,
        barber: true,
        services: { include: { service: true } },
      },
      orderBy: {
        date: 'desc',
      },
    });
    return appointments.map(apt => ({
      ...apt,
      services: apt.services.map(s => ({
        id: s.service.id,
        name: s.service.name,
        price: s.price,
      })),
    }));
  }

  async getAvailableSlots(date: string, barberId: number) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        barberId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        services: { include: { service: true } },
      },
    });

    const slots = [];
    const workingHours = {
      start: 9, // 9 AM
      end: 21, // 9 PM
    };

    for (let hour = workingHours.start; hour < workingHours.end; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotTime = new Date(date);
        slotTime.setHours(hour, minute, 0, 0);

        let isAvailable = true;

        for (const appointment of appointments) {
          const appointmentStart = new Date(appointment.date);
          const totalDuration = appointment.services.reduce((sum, s) => sum + (s.service?.duration || 0), 0);
          const appointmentEnd = new Date(appointmentStart.getTime() + totalDuration * 60000);

          const slotEnd = new Date(slotTime.getTime() + 30 * 60000);

          if (
            (slotTime >= appointmentStart && slotTime < appointmentEnd) ||
            (slotEnd > appointmentStart && slotEnd <= appointmentEnd)
          ) {
            isAvailable = false;
            break;
          }
        }

        if (isAvailable) {
          slots.push(slotTime);
        }
      }
    }

    return slots;
  }

  async create(createAppointmentDto: CreateAppointmentDto) {
    const { customerId, barberId, date, notes, services } = createAppointmentDto;
    // ثبت نوبت بدون serviceId
    const appointment = await this.prisma.appointment.create({
      data: {
        customerId: Number(customerId),
        barberId: Number(barberId),
        date: new Date(date),
        notes,
        updatedAt: new Date(),
      },
    });
    // درج خدمات مرتبط با نوبت
    await Promise.all(
      services.map(s =>
        this.prisma.appointmentService.create({
          data: {
            appointmentId: appointment.id,
            serviceId: s.serviceId,
            price: s.price,
            updatedAt: new Date(),
          },
        })
      )
    );
    // بازگرداندن نوبت با خدمات
    const result = await this.prisma.appointment.findUnique({
      where: { id: appointment.id },
      include: {
        customer: true,
        barber: true,
        services: {
          include: { service: true },
        },
      },
    });
    return result;
  }

  async update(id: number, updateAppointmentDto: UpdateAppointmentDto) {
    const { customerId, barberId, date, notes, status, amount } = updateAppointmentDto;

    // دریافت وضعیت قبلی نوبت
    const prevAppointment = await this.prisma.appointment.findUnique({ where: { id }, include: { transactions: true } });

    const updateData: any = { updatedAt: new Date() };
    if (typeof customerId !== 'undefined') updateData.customerId = customerId;
    if (typeof barberId !== 'undefined') updateData.barberId = barberId;
    if (typeof date !== 'undefined') updateData.date = new Date(date);
    if (typeof notes !== 'undefined') updateData.notes = notes;
    if (typeof status !== 'undefined') updateData.status = status;

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        barber: true,
        services: { include: { service: true } },
        transactions: true,
      },
    });

    // اگر وضعیت به COMPLETED یا SETTLED تغییر کرد و قبلاً تسویه نشده بود
    if ((status === 'COMPLETED' || status === 'SETTLED') && (!prevAppointment?.transactions || prevAppointment.transactions.length === 0)) {
      // پیدا کردن دسته‌بندی درآمد خدمات
      const category = await this.prisma.financialCategory.findFirst({
        where: { name: 'درآمد خدمات', type: 'INCOME' },
      });
      let serviceCategory = category;
      if (!serviceCategory) {
        serviceCategory = await this.prisma.financialCategory.create({
          data: {
            name: 'درآمد خدمات',
            type: 'INCOME',
            description: 'درآمد حاصل از ارائه خدمات آرایشگاه',
            updatedAt: new Date(),
          },
        });
      }
      // جمع مبلغ خدمات این نوبت
      const totalServiceAmount = appointment.services.reduce((sum, s) => sum + (s.price || 0), 0);
      const finalAmount = amount || totalServiceAmount;
      const appointmentDate = new Date(appointment.date);
      const formattedDate = appointmentDate.toLocaleDateString('fa-IR');
      const formattedTime = appointmentDate.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      const description = `بابت تسویه نوبت #${appointment.id} برای مشتری ${appointment.customer?.firstName || ''} ${appointment.customer?.lastName || ''} توسط آرایشگر ${appointment.barber?.firstName || ''} ${appointment.barber?.lastName || ''} در تاریخ ${formattedDate} ساعت ${formattedTime}`;
      const entry = await this.accountingService.createEntry({
        amount: finalAmount,
        type: 'INCOME',
        date: new Date().toISOString(),
        description: description,
        categoryId: serviceCategory.id,
        reference: `APPT-${appointment.id}`,
        paymentMethod: 'CASH',
        createdBy: 1, // فرض: ادمین
      });
      // ایجاد تراکنش مرتبط با نوبت
      await this.prisma.transaction.create({
        data: {
          appointment: { connect: { id: appointment.id } },
          amount: finalAmount,
          status: 'COMPLETED',
          category: 'SERVICE_PAYMENT',
          paymentMethod: 'CASH',
          updatedAt: new Date(),
          type: 'NORMAL',
          description: description,
        },
      });
    }
    // اگر وضعیت به CANCELLED تغییر کرد و قبلاً تسویه شده بود
    if (status === 'CANCELLED' && prevAppointment?.transactions && prevAppointment.transactions.length > 0) {
      await this.prisma.financialEntry.deleteMany({ where: { reference: `APPT-${appointment.id}` } });
      await this.prisma.transaction.deleteMany({ where: { appointmentId: appointment.id } });
    }
    return appointment;
  }

  async remove(id: number) {
    return this.prisma.appointment.delete({
      where: { id },
    });
  }

  async getBarberAppointments(barberId: number, date: string) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        barberId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        customer: true,
        services: { include: { service: true } },
      },
      orderBy: {
        date: 'asc',
      },
    });

    return appointments.map(apt => ({
      id: apt.id,
      time: apt.date,
      duration: apt.services.reduce((sum, s) => sum + (s.service?.duration || 0), 0),
      services: apt.services,
      customerId: apt.customerId,
      notes: apt.notes,
      status: apt.status,
    }));
  }

  async settleAppointment(id: number, settleDto: { amount?: number; paymentMethod?: string; tipAmount?: number }) {
    const { amount, paymentMethod = 'CASH', tipAmount = 0 } = settleDto;
    // دریافت حساب بانکی پیش‌فرض
    const defaultBankSetting = await this.accountingService.getSetting('default_settlement_bank_account_id');
    const defaultBankAccountId = defaultBankSetting ? Number(defaultBankSetting.value) : null;
    // دریافت نوبت با جزئیات کامل
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        customer: true,
        barber: true,
        services: { include: { service: true } },
        transactions: true,
      },
    });
    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }
    if (appointment.transactions && appointment.transactions.length > 0) {
      throw new Error('این نوبت قبلاً تسویه شده است');
    }
    if (appointment.status !== 'COMPLETED' && appointment.status !== 'CONFIRMED' && appointment.status !== 'PENDING') {
      throw new Error('نوبت باید در وضعیت در انتظار، تایید شده یا تکمیل شده باشد');
    }
    let serviceCategory = await this.prisma.financialCategory.findFirst({ where: { name: 'درآمد خدمات', type: 'INCOME' } });
    if (!serviceCategory) {
      serviceCategory = await this.prisma.financialCategory.create({
        data: {
          name: 'درآمد خدمات',
          type: 'INCOME',
          description: 'درآمد حاصل از ارائه خدمات آرایشگاه',
          updatedAt: new Date(),
        },
      });
    }
    // جمع مبلغ خدمات این نوبت
    const totalServiceAmount = appointment.services.reduce((sum, s) => sum + (s.price || 0), 0);
    // منطق جدید: هر عددی که کاربر وارد کند همان ثبت شود
    let serviceAmount = typeof amount === 'number' ? amount : totalServiceAmount;
    let tip = typeof tipAmount === 'number' ? tipAmount : 0;
    // اگر منفی بود اصلاح شود
    if (serviceAmount < 0) serviceAmount = 0;
    if (tip < 0) tip = 0;
    const appointmentDate = new Date(appointment.date);
    const formattedDate = appointmentDate.toLocaleDateString('fa-IR');
    const formattedTime = appointmentDate.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const description = `بابت تسویه نوبت #${appointment.id} برای مشتری ${appointment.customer?.firstName || ''} ${appointment.customer?.lastName || ''} توسط آرایشگر ${appointment.barber?.firstName || ''} ${appointment.barber?.lastName || ''} در تاریخ ${formattedDate} ساعت ${formattedTime}`;
    // ثبت ورودی مالی برای مبلغ خدمات
    if (serviceAmount > 0) {
      await this.accountingService.createEntry({
        amount: serviceAmount,
        type: 'INCOME',
        date: new Date().toISOString(),
        description: description,
        categoryId: serviceCategory.id,
        reference: `APPT-${appointment.id}`,
        paymentMethod: paymentMethod,
        createdBy: 1, // فرض: ادمین
        ...(defaultBankAccountId && { bankAccountId: defaultBankAccountId }),
      });
      // ثبت تراکنش خدمات
      await this.prisma.transaction.create({
        data: {
          appointment: { connect: { id: appointment.id } },
          amount: serviceAmount,
          status: 'COMPLETED',
          type: 'NORMAL',
          paymentMethod: paymentMethod,
          updatedAt: new Date(),
        },
      });
    }
    // ثبت تراکنش تیپ (در صورت وجود)
    if (tip > 0) {
      let tipCategory = await this.prisma.financialCategory.findFirst({ where: { name: 'تیپ', type: 'INCOME' } });
      if (!tipCategory) {
        tipCategory = await this.prisma.financialCategory.create({
          data: {
            name: 'تیپ',
            type: 'INCOME',
            description: 'درآمد حاصل از تیپ مشتریان',
            updatedAt: new Date(),
          },
        });
      }
      const tipDescription = `تیپ بابت نوبت #${appointment.id} برای مشتری ${appointment.customer?.firstName || ''} ${appointment.customer?.lastName || ''}`;
      await this.accountingService.createEntry({
        amount: tip,
        type: 'INCOME',
        date: new Date().toISOString(),
        description: tipDescription,
        categoryId: tipCategory.id,
        reference: `APPT-${appointment.id}`,
        paymentMethod: paymentMethod,
        createdBy: 1,
        ...(defaultBankAccountId && { bankAccountId: defaultBankAccountId }),
      });
      await this.prisma.transaction.create({
        data: {
          appointment: { connect: { id: appointment.id } },
          amount: tip,
          status: 'COMPLETED',
          type: 'NORMAL',
          paymentMethod: paymentMethod,
          updatedAt: new Date(),
          description: tipDescription,
        },
      });
    }
    // آپدیت وضعیت نوبت به COMPLETED
    await this.prisma.appointment.update({ where: { id }, data: { status: 'COMPLETED', updatedAt: new Date() } });
    return { ...appointment, serviceAmount, tipAmount: tip };
  }

  async cancelSettledAppointment(id: number) {
    // دریافت نوبت با جزئیات کامل
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        customer: true,
        barber: true,
        services: { include: { service: true } },
        transactions: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    // بررسی اینکه آیا نوبت تسویه شده یا نه
    if (!appointment.transactions || appointment.transactions.length === 0) {
      throw new Error('این نوبت تسویه نشده است');
    }

    // بررسی اینکه نوبت در وضعیت COMPLETED باشد
    if (appointment.status !== 'COMPLETED') {
      throw new Error('فقط نوبت‌های تکمیل شده قابل لغو هستند');
    }

    console.log('Cancelling settled appointment, deleting financial entry and transaction:', { appointmentId: appointment.id });
    
    // حذف ورودی مالی مرتبط
    await this.prisma.financialEntry.deleteMany({
      where: { reference: `APPT-${appointment.id}` },
    });
    
    // حذف تراکنش مرتبط
    await this.prisma.transaction.deleteMany({
      where: { appointmentId: appointment.id },
    });

    // به‌روزرسانی وضعیت نوبت به CANCELLED
    const updatedAppointment = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date(),
      },
      include: {
        customer: true,
        barber: true,
        services: { include: { service: true } },
        transactions: true,
      },
    });

    console.log(`✅ نوبت #${appointment.id} لغو شد و تراکنش‌های مالی حذف شدند`);

    return {
      appointment: updatedAppointment,
      message: 'نوبت با موفقیت لغو شد و تراکنش‌های مالی حذف شدند'
    };
  }
}
