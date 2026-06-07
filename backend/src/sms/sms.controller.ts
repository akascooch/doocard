import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { SmsService } from './sms.service';
import { UpdateSmsSettingsDto } from './dto/update-sms-settings.dto';

@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Get('settings')
  getSettings() {
    return this.smsService.getSettings();
  }

  @Patch('settings')
  async updateSettings(@Body() data: UpdateSmsSettingsDto) {
    return this.smsService.saveSettings(data);
  }

  @Post('templates')
  createTemplate(@Body() data: { name: string; content: string }) {
    return this.smsService.createTemplate(data.name, data.content);
  }

  @Get('templates')
  getAllTemplates() {
    return this.smsService.getAllTemplates();
  }

  @Get('templates/:id')
  getTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.smsService.getTemplate(id);
  }

  @Post('templates/:id')
  updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { name: string; content: string },
  ) {
    return this.smsService.updateTemplate(id, data.name, data.content);
  }

  @Delete('templates/:id')
  async removeTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.smsService.updateTemplate(id, 'DELETED', '');
  }

  @Get('logs')
  async getSmsLogs() {
    return this.smsService.getSmsLogs();
  }

  @Post('send')
  async sendSms(
    @Body() data: { message: string; phoneNumber: string; customerId?: number },
  ) {
    try {
      return await this.smsService.logSms(
        data.phoneNumber,
        data.message,
        'SUCCESS',
        undefined,
        data.customerId,
      );
    } catch (error) {
      return this.smsService.logError(
        data.phoneNumber,
        data.message,
        error.message,
        data.customerId,
      );
    }
  }

  @Post('send-template')
  async sendTemplate(
    @Body('templateId', ParseIntPipe) templateId: number,
    @Body('phone') phone: string,
    @Body('type') type: string,
    @Body('userId', ParseIntPipe) userId: number,
    @Body('data') data: any,
  ) {
    const template = await this.smsService.getTemplate(templateId);
    if (!template) {
      throw new Error('قالب پیامک یافت نشد');
    }

    let message = template.content;
    if (data) {
      Object.keys(data).forEach((key) => {
        message = message.replace(`{${key}}`, data[key]);
      });
    }

    return this.smsService.logSms(phone, message, type, undefined, userId);
  }
} 