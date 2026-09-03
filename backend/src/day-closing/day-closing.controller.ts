import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DayClosingService } from './day-closing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('day-closing')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DayClosingController {
  constructor(private readonly dayClosingService: DayClosingService) {}

  @Get('history')
  @Roles('ADMIN')
  async getDayClosingHistory(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 30;
    return this.dayClosingService.getDayClosingHistory(limitNum);
  }

  @Get(':date')
  @Roles('ADMIN', 'EMPLOYEE')
  async getDayClosing(@Param('date') date: string) {
    const dateObj = new Date(date);
    return this.dayClosingService.getDayClosing(dateObj);
  }

  @Post(':date/close')
  @Roles('ADMIN')
  async closeDay(@Param('date') date: string, @Body() body: { closedBy: number }) {
    const dateObj = new Date(date);
    return this.dayClosingService.closeDay(dateObj, body.closedBy);
  }

  @Post(':date/reopen')
  @Roles('ADMIN')
  async reopenDay(@Param('date') date: string, @Body() body: { reopenedBy: number }) {
    const dateObj = new Date(date);
    return this.dayClosingService.reopenDay(dateObj, body.reopenedBy);
  }
}
