import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { EmployeeSalaryService } from './employee-salary.service';
import { CommitEmployeeCommissionSettlementDto } from './dto/commit-employee-commission-settlement.dto';

@Controller('admin/employee-salary')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeeSalaryController {
  constructor(private readonly employeeSalaryService: EmployeeSalaryService) {}

  @Get('preview')
  @Roles('ADMIN')
  async preview(
    @Query('employeeId') employeeIdStr: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('percentage') percentageStr?: string,
  ) {
    const employeeId = parseInt(employeeIdStr || '0', 10);
    if (isNaN(employeeId) || employeeId < 1) {
      throw new BadRequestException('Invalid employeeId');
    }

    const percentage =
      percentageStr !== undefined && percentageStr !== ''
        ? parseFloat(percentageStr)
        : undefined;
    if (
      percentage !== undefined &&
      (isNaN(percentage) || percentage < 0 || percentage > 100)
    ) {
      throw new BadRequestException('Percentage must be between 0 and 100');
    }

    if (!from || !to) {
      throw new BadRequestException('from and to (Jalali dates) are required');
    }

    return this.employeeSalaryService.preview({
      employeeId,
      fromJalali: from,
      toJalali: to,
      percentage,
    });
  }

  @Get('history')
  @Roles('ADMIN')
  async history(@Query('employeeId', ParseIntPipe) employeeId: number) {
    return this.employeeSalaryService.getSettlementHistory(employeeId);
  }

  @Post('commit')
  @Roles('ADMIN')
  async commit(
    @Body() dto: CommitEmployeeCommissionSettlementDto,
    @Req() req: { user?: { id?: number; sub?: number } },
  ) {
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.employeeSalaryService.commitSettlement(dto, userId);
  }

  @Post(':id/reverse')
  @Roles('ADMIN')
  async reverse(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user?: { id?: number; sub?: number } },
  ) {
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.employeeSalaryService.reverseSettlement(id, userId);
  }
}
