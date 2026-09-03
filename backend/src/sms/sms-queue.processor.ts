import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { SmsServiceEnhanced } from './sms.service.enhanced';

interface SmsJobData {
  appointmentId: number;
}

/**
 * SMS Queue Processor
 * Processes SMS jobs from the queue with retry logic
 */
@Processor('sms')
export class SmsQueueProcessor {
  private readonly logger = new Logger(SmsQueueProcessor.name);

  constructor(
    private prisma: PrismaService,
    private smsService: SmsServiceEnhanced,
  ) {}

  @Process()
  async handleSmsJob(job: Job<SmsJobData>) {
    const { appointmentId } = job.data;

    this.logger.log(`📨 Processing SMS job for appointment ${appointmentId} (Attempt ${job.attemptsMade + 1}/3)`);

    try {
      // 1. Fetch appointment with related data
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          customer: {
            include: {
              user: true,
            },
          },
          employee: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!appointment) {
        this.logger.error(`❌ Appointment ${appointmentId} not found`);
        throw new Error(`Appointment ${appointmentId} not found`);
      }

      // 2. Build recipients list
      const recipients: string[] = [];

      // Add stylist/employee phone
      if (appointment.employee?.user?.phone) {
        recipients.push(appointment.employee.user.phone);
        this.logger.debug(`Added stylist phone: ${appointment.employee.user.phone}`);
      }

      // Add all MANAGER users
      const managers = await this.prisma.user.findMany({
        where: {
          role: 'MANAGER',
          phone: {
            not: null,
          },
        },
        select: {
          phone: true,
          name: true,
        },
      });

      managers.forEach((manager) => {
        if (manager.phone) {
          recipients.push(manager.phone);
          this.logger.debug(`Added manager phone: ${manager.phone} (${manager.name})`);
        }
      });

      if (recipients.length === 0) {
        this.logger.warn(`⚠️  No recipients found for appointment ${appointmentId}`);
        return {
          success: true,
          message: 'No recipients to notify',
        };
      }

      // 3. Normalize phone numbers
      const normalizedRecipients = recipients
        .map((phone) => this.smsService.normalizePhoneNumber(phone))
        .filter((phone) => phone !== null);

      if (normalizedRecipients.length === 0) {
        this.logger.error(`❌ No valid phone numbers for appointment ${appointmentId}`);
        throw new Error('No valid phone numbers');
      }

      // 4. Build SMS message
      const customerName = appointment.customer?.user?.name || 'مشتری';
      const stylistName = appointment.employee?.user?.name || 'نامشخص';
      
      // Parse services from JSON
      let serviceNames = 'خدمات';
      try {
        const services = appointment.services as any[];
        if (Array.isArray(services) && services.length > 0) {
          serviceNames = services
            .map((s) => s.serviceName || s.name)
            .filter(Boolean)
            .join('، ');
        }
      } catch (e) {
        this.logger.warn('Failed to parse services:', e.message);
      }

      // Format date in Persian
      const appointmentDate = new Date(appointment.scheduledAt);
      const persianDate = appointmentDate.toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Tehran',
      });

      const message = `🔔 نوبت جدید ثبت شد

👤 مشتری: ${customerName}
💈 آرایشگر: ${stylistName}
📅 تاریخ: ${persianDate}
✂️ خدمات: ${serviceNames}

لطفاً نوبت را بررسی و تأیید کنید.`;

      // 5. Create pending SMS events
      const events = normalizedRecipients.map((phone) => ({
        appointmentId,
        to: phone,
        message,
        status: 'PENDING',
        attempts: 0,
      }));

      await this.prisma.smsEvent.createMany({
        data: events,
      });

      this.logger.log(`📝 Created ${events.length} SMS event(s) in database`);

      // 6. Send SMS
      const response = await this.smsService.sendSms(
        normalizedRecipients,
        message,
        appointmentId,
      );

      if (response.success) {
        this.logger.log(`✅ SMS sent successfully for appointment ${appointmentId}`);
        
        // Update all events to SENT
        await this.prisma.smsEvent.updateMany({
          where: {
            appointmentId,
            status: 'PENDING',
          },
          data: {
            status: 'SENT',
            providerResp: response.providerResponse
              ? JSON.stringify(response.providerResponse)
              : null,
            lastAttemptAt: new Date(),
          },
        });

        return {
          success: true,
          messageId: response.messageId,
          recipientCount: normalizedRecipients.length,
        };
      } else {
        this.logger.error(`❌ SMS failed for appointment ${appointmentId}: ${response.error}`);
        
        // Update events to FAILED if max attempts reached
        if (job.attemptsMade >= 2) {
          await this.prisma.smsEvent.updateMany({
            where: {
              appointmentId,
              status: 'PENDING',
            },
            data: {
              status: 'FAILED',
              providerResp: response.providerResponse
                ? JSON.stringify(response.providerResponse)
                : null,
              lastAttemptAt: new Date(),
              attempts: {
                increment: 1,
              },
            },
          });
        }

        throw new Error(response.error || 'SMS sending failed');
      }
    } catch (error) {
      this.logger.error(
        `❌ SMS job failed for appointment ${appointmentId} (Attempt ${job.attemptsMade + 1}):`,
        error.stack,
      );

      // If this is the last attempt, mark as failed
      if (job.attemptsMade >= 2) {
        this.logger.error(`❌ Max attempts reached for appointment ${appointmentId}. Marking as FAILED.`);
      }

      throw error; // Re-throw to trigger Bull's retry mechanism
    }
  }
}

