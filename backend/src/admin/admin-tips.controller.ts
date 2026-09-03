import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AdminTipsService } from './admin-tips.service';
import { CreateManualTipDto, PreviewManualTipDto } from './dto/manual-tip.dto';

@Controller('admin/tips')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AdminTipsController {
  constructor(private readonly adminTipsService: AdminTipsService) {}

  @Get('report')
  @Roles('ADMIN', 'ACCOUNTANT')
  async report(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('tipType') tipType?: 'ALL' | 'TEAM' | 'INDIVIDUAL',
    @Query('origin') origin?: 'ALL' | 'APPOINTMENT' | 'MANUAL',
    @Query('employeeId') employeeIdStr?: string,
    @Query('paidState') paidState?: 'ALL' | 'PAID' | 'UNPAID',
    @Query('dateAxis') dateAxis?: 'PAID_AT' | 'SCHEDULED_AT',
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('from و to (تاریخ شمسی) الزامی است');
    }
    if (dateAxis && dateAxis !== 'PAID_AT' && dateAxis !== 'SCHEDULED_AT') {
      throw new BadRequestException('dateAxis باید PAID_AT یا SCHEDULED_AT باشد');
    }
    const employeeId = employeeIdStr
      ? parseInt(employeeIdStr, 10)
      : undefined;
    if (employeeIdStr && (isNaN(employeeId!) || employeeId! < 1)) {
      throw new BadRequestException('employeeId نامعتبر است');
    }
    return this.adminTipsService.report({
      fromJalali: from,
      toJalali: to,
      tipType: tipType || 'ALL',
      origin: origin || 'ALL',
      employeeId,
      paidState: paidState || 'ALL',
      dateAxis: dateAxis || 'PAID_AT',
      page: pageStr ? parseInt(pageStr, 10) : 1,
      pageSize: pageSizeStr ? parseInt(pageSizeStr, 10) : 50,
    });
  }

  @Post('preview')
  @Roles('ADMIN')
  async preview(@Body() dto: PreviewManualTipDto, @Req() req: { user?: { role?: string } }) {
    this.adminTipsService.assertCanCreate(req.user?.role || '');
    return this.adminTipsService.preview(dto);
  }

  @Post()
  @Roles('ADMIN')
  async create(
    @Body() dto: CreateManualTipDto,
    @Req() req: { user?: { id?: number; sub?: number; role?: string } },
  ) {
    this.adminTipsService.assertCanCreate(req.user?.role || '');
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new BadRequestException('کاربر احراز هویت نشده است');
    }
    return this.adminTipsService.create(dto, userId);
  }
}
