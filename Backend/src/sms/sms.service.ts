import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSmsSettingsDto } from './dto/update-sms-settings.dto';

@Injectable()
export class SmsService {
  constructor(private prisma: PrismaService) {}

  async initializeSettings() {
    const settings = await this.prisma.smsSettings.findFirst();
    if (!settings) {
      return this.prisma.smsSettings.create({
        data: {
          apiKey: '',
          lineNumber: '',
          isEnabled: false,
          sendBeforeAppointment: 60,
          sendAfterAppointment: 0,
          defaultMessage: '',
          updatedAt: new Date(),
        },
      });
    }
    return settings;
  }

  async createTemplate(name: string, content: string) {
    return this.prisma.smsTemplate.create({
      data: {
        name,
        content,
        variables: [],
        updatedAt: new Date(),
      },
    });
  }

  async getTemplate(id: number) {
    return this.prisma.smsTemplate.findUnique({
      where: { id },
    });
  }

  async getSettings() {
    const settings = await this.prisma.smsSettings.findFirst();
    if (!settings || !settings.apiKey || !settings.lineNumber) {
      throw new Error('SMS settings not configured');
    }
    return settings;
  }

  async logSms(phoneNumber: string, message: string, status: string, error?: string, customerId?: number) {
    return this.prisma.smsLog.create({
      data: {
        phoneNumber,
        message,
        status,
        error,
        customerId,
        createdAt: new Date(),
      },
    });
  }

  async logError(phoneNumber: string, message: string, error: string, customerId?: number) {
    return this.prisma.smsLog.create({
      data: {
        phoneNumber,
        message,
        status: 'ERROR',
        error,
        customerId,
        createdAt: new Date(),
      },
    });
  }

  async getAllTemplates() {
    return this.prisma.smsTemplate.findMany({
      where: {
        isActive: true,
      },
    });
  }

  async updateTemplate(id: number, name: string, content: string) {
    return this.prisma.smsTemplate.update({
      where: { id },
      data: {
        name,
        content,
        updatedAt: new Date(),
      },
    });
  }

  async saveSettings(data: UpdateSmsSettingsDto) {
    const settings = await this.prisma.smsSettings.findFirst();
    if (!settings) {
      return this.prisma.smsSettings.create({
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });
    }
    return this.prisma.smsSettings.update({
      where: { id: settings.id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async getSmsLogs() {
    return this.prisma.smsLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: true,
      },
    });
  }
} 