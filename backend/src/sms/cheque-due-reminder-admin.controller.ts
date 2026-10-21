import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { ChequeDueSmsReminderService } from './cheque-due-sms-reminder.service';

export class ChequeReminderTestSendDto {
  /** Raw JSON value: global enableImplicitConversion would turn "false" into true. */
  @Transform(({ obj }) => obj.confirm)
  @IsBoolean()
  confirm: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  leafId?: number;
}

/** One controlled test send per window for all admins (in-memory, per backend process). */
export const CHEQUE_TEST_SEND_COOLDOWN_MS = 5 * 60_000;

@Controller('admin/sms/cheques/due-reminder')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Roles('ADMIN')
export class ChequeDueReminderAdminController {
  private readonly logger = new Logger(ChequeDueReminderAdminController.name);
  private lastTestSendAt = 0;

  constructor(private readonly reminders: ChequeDueSmsReminderService) {}

  /** Read-only. Never sends, independent of CHEQUE_DUE_SMS_ENABLED. */
  @Get('preview')
  preview(@Query('days') days?: string) {
    return this.reminders.previewPlan({ days: days == null ? 3 : Number(days) });
  }

  @Post('test-send')
  async testSend(@Body() dto: ChequeReminderTestSendDto, @Req() req: any) {
    if (dto.confirm !== true) {
      throw new BadRequestException('برای ارسال تست، confirm=true الزامی است');
    }
    if (!this.reminders.isTestMode()) {
      throw new BadRequestException('CHEQUE_DUE_SMS_TEST_PHONES تنظیم نشده است');
    }
    const now = Date.now();
    if (now - this.lastTestSendAt < CHEQUE_TEST_SEND_COOLDOWN_MS) {
      throw new HttpException(
        'ارسال تست اخیراً انجام شده است؛ چند دقیقه بعد دوباره تلاش کنید',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.lastTestSendAt = now;
    const actorId = Number(req?.user?.id ?? req?.user?.sub) || null;
    this.logger.warn(`Cheque due TEST send requested by admin=${actorId} leaf=${dto.leafId ?? 'nearest'}`);
    return this.reminders.sendTestReminder({ leafId: dto.leafId });
  }
}
