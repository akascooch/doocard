import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from './sms.service';
import { AppointmentStatus } from '@prisma/client';

interface AppointmentWithRelations {
  id: number;
  date: Date;
  customer: {
    id: number;
    phoneNumber: string;
    firstName: string;
    lastName: string;
  };
  service: {
    name: string;
  };
  barber: {
    firstName: string;
    lastName: string;
  };
}

@Injectable()
export class SmsScheduler {
  constructor(
    private prisma: PrismaService,
    private smsService: SmsService,
  ) {}

  @Cron('0 */5 * * * *') // Every 5 minutes
  async handleAppointmentReminders() {
    const settings = await this.smsService.getSettings();
    if (!settings.isEnabled || !settings.sendBeforeAppointment) return;

    const minutesBeforeAppointment = settings.sendBeforeAppointment;
    const targetTime = new Date();
    targetTime.setMinutes(targetTime.getMinutes() + minutesBeforeAppointment);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        date: {
          gte: new Date(),
          lte: targetTime,
        },
        reminderSent: false,
        status: AppointmentStatus.CONFIRMED,
      },
      include: {
        customer: true,
        barber: true,
        services: { include: { service: true } },
      },
    });

    for (const appointment of appointments) {
      try {
        const message = this.formatReminderMessage(appointment);
        await this.smsService.logSms(
          appointment.customer.phoneNumber,
          message,
          'REMINDER',
          undefined,
          appointment.customer.id,
        );

        await this.prisma.appointment.update({
          where: { id: appointment.id },
          data: { reminderSent: true },
        });
      } catch (error) {
        await this.smsService.logError(
          appointment.customer.phoneNumber,
          'Reminder message',
          error.message,
          appointment.customer.id,
        );
      }
    }
  }

  @Cron('0 */5 * * * *') // Every 5 minutes
  async handleFollowUpMessages() {
    const settings = await this.smsService.getSettings();
    if (!settings.isEnabled || !settings.sendAfterAppointment) return;

    const minutesAfterAppointment = settings.sendAfterAppointment;
    const targetTime = new Date();
    targetTime.setMinutes(targetTime.getMinutes() - minutesAfterAppointment);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        date: {
          gte: targetTime,
          lte: new Date(),
        },
        followUpSent: false,
        status: AppointmentStatus.COMPLETED,
      },
      include: {
        customer: true,
        barber: true,
        services: { include: { service: true } },
      },
    });

    for (const appointment of appointments) {
      try {
        const message = this.formatFollowUpMessage(appointment);
        await this.smsService.logSms(
          appointment.customer.phoneNumber,
          message,
          'FOLLOW_UP',
          undefined,
          appointment.customer.id,
        );

        await this.prisma.appointment.update({
          where: { id: appointment.id },
          data: { followUpSent: true },
        });
      } catch (error) {
        await this.smsService.logError(
          appointment.customer.phoneNumber,
          'Follow-up message',
          error.message,
          appointment.customer.id,
        );
      }
    }
  }

  private formatReminderMessage(appointment: any): string {
    const date = new Date(appointment.date).toLocaleString();
    const serviceNames = appointment.services.map((s: any) => s.service?.name).filter(Boolean).join(', ');
    return `Reminder: You have an appointment for ${serviceNames} with ${appointment.barber.firstName} at ${date}`;
  }

  private formatFollowUpMessage(appointment: any): string {
    const serviceNames = appointment.services.map((s: any) => s.service?.name).filter(Boolean).join(', ');
    return `Thank you for visiting us! We hope you enjoyed your ${serviceNames} service(s) with ${appointment.barber.firstName}. Please let us know about your experience!`;
  }
} 