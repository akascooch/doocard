import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { LotteryService } from './lottery.service';
import { LotteryCronService } from './lottery-cron.service';

@Controller('admin/lottery')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class LotteryAdminController {
  constructor(
    private readonly lottery: LotteryService,
    private readonly cron: LotteryCronService,
  ) {}

  @Get('groups')
  @Roles('ADMIN', 'ACCOUNTANT')
  listGroups() {
    return this.lottery.listGroups();
  }

  @Get('employee-options')
  @Roles('ADMIN', 'ACCOUNTANT')
  employeeOptions() {
    return this.lottery.employeeOptions();
  }

  @Post('groups')
  @Roles('ADMIN')
  createGroup(@Body() dto: any, @Req() req: { user?: { id?: number; sub?: number } }) {
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) throw new BadRequestException('کاربر احراز هویت نشده است');
    return this.lottery.createGroup(dto, userId);
  }

  @Get('groups/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  getGroup(@Param('id', ParseIntPipe) id: number) {
    return this.lottery.getGroup(id);
  }

  @Patch('groups/:id')
  @Roles('ADMIN')
  patchGroup(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.lottery.patchGroup(id, dto);
  }

  @Put('groups/:id/members')
  @Roles('ADMIN')
  replaceMembers(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { employeeIds?: number[] },
  ) {
    return this.lottery.replaceMembers(id, dto.employeeIds ?? []);
  }

  @Post('groups/:id/cycles')
  @Roles('ADMIN')
  startCycle(@Param('id', ParseIntPipe) id: number) {
    return this.lottery.startCycle(id);
  }

  @Get('groups/:id/cycles/:cycleId/preview-next')
  @Roles('ADMIN', 'ACCOUNTANT')
  previewNext(
    @Param('id', ParseIntPipe) id: number,
    @Param('cycleId', ParseIntPipe) cycleId: number,
  ) {
    return this.lottery.previewNextCycle(id, cycleId);
  }

  @Post('groups/:id/cron/dry-run')
  @Roles('ADMIN', 'ACCOUNTANT')
  dryRun(@Param('id', ParseIntPipe) id: number) {
    return this.lottery.runGroupPeriod(id, { mode: 'dry-run' });
  }

  @Post('groups/:id/cron/run')
  @Roles('ADMIN')
  async run(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { confirm?: boolean },
    @Req() req: { user?: { role?: string } },
  ) {
    if (req.user?.role === 'ACCOUNTANT') {
      throw new ForbiddenException('حسابدار مجاز به اجرای کرون نیست');
    }
    if (dto?.confirm !== true) {
      throw new BadRequestException('confirm باید true باشد');
    }
    if (!this.cron.isEnabled()) {
      throw new ForbiddenException('کرون قرعه‌کشی در این محیط خاموش است');
    }
    return this.lottery.runGroupPeriod(id, { mode: 'live' });
  }

  @Post('members/:memberId/prepaid')
  @Roles('ADMIN')
  prepaid(
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: any,
    @Req() req: { user?: { id?: number; sub?: number } },
  ) {
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) throw new BadRequestException('کاربر احراز هویت نشده است');
    return this.lottery.topUpPrepaid(memberId, dto, userId);
  }
}

@Controller('lottery')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class LotteryStaffController {
  constructor(private readonly lottery: LotteryService) {}

  @Get('me')
  @Roles('EMPLOYEE', 'SERVICE')
  me(@Req() req: { user?: { id?: number; sub?: number } }) {
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) throw new BadRequestException('کاربر احراز هویت نشده است');
    return this.lottery.me(userId);
  }
}
