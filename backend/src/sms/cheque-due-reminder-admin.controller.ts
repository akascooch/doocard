import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { ChequeDueSmsReminderService } from './cheque-due-sms-reminder.service';

@Controller('admin/sms/cheques/due-reminder')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Roles('ADMIN')
export class ChequeDueReminderAdminController {
  constructor(private readonly reminders: ChequeDueSmsReminderService) {}

  /** Read-only. Never sends, independent of CHEQUE_DUE_SMS_ENABLED. */
  @Get('preview')
  preview() {
    return this.reminders.previewPlan();
  }
}
