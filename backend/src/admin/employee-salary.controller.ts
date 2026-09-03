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
import { EmployeeSalaryRequestStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { EmployeeSalaryService } from './employee-salary.service';
import { EmployeeSalaryRequestService } from './employee-salary-request.service';
import { CommitEmployeeCommissionSettlementDto } from './dto/commit-employee-commission-settlement.dto';

@Controller('admin/employee-salary')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeeSalaryController {
  constructor(
    private readonly employeeSalaryService: EmployeeSalaryService,
    private readonly salaryRequestService: EmployeeSalaryRequestService,
  ) {}

  @Get('preview')
  @Roles('ADMIN', 'ACCOUNTANT')
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
  @Roles('ADMIN', 'ACCOUNTANT')
  async history(@Query('employeeId', ParseIntPipe) employeeId: number) {
    return this.employeeSalaryService.getSettlementHistory(employeeId);
  }

  @Post('commit')
  @Roles('ADMIN', 'ACCOUNTANT')
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
  @Roles('ADMIN', 'ACCOUNTANT')
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

  @Get('requests')
  @Roles('ADMIN', 'ACCOUNTANT')
  async listRequests(@Query('status') status?: EmployeeSalaryRequestStatus) {
    return this.salaryRequestService.listAdmin(status);
  }

  @Get('requests/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  async getRequest(@Param('id', ParseIntPipe) id: number) {
    return this.salaryRequestService.getAdminById(id);
  }

  @Get('requests/:id/pay-diff')
  @Roles('ADMIN', 'ACCOUNTANT')
  async payDiff(@Param('id', ParseIntPipe) id: number) {
    return this.salaryRequestService.previewPayDiff(id);
  }

  @Post('requests/:id/approve')
  @Roles('ADMIN', 'ACCOUNTANT')
  async approveRequest(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user?: { id?: number; sub?: number } },
  ) {
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.salaryRequestService.approve(id, userId);
  }

  @Post('requests/:id/reject')
  @Roles('ADMIN', 'ACCOUNTANT')
  async rejectRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: string },
    @Req() req: { user?: { id?: number; sub?: number } },
  ) {
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.salaryRequestService.reject(id, userId, body?.reason);
  }

  @Post('requests/:id/pay')
  @Roles('ADMIN', 'ACCOUNTANT')
  async payRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { bankAccountId: number },
    @Req() req: { user?: { id?: number; sub?: number } },
  ) {
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) throw new BadRequestException('User not authenticated');
    if (!body?.bankAccountId) {
      throw new BadRequestException('bankAccountId الزامی است');
    }
    return this.salaryRequestService.pay(id, userId, body.bankAccountId);
  }

  @Post('requests/:id/cancel')
  @Roles('ADMIN', 'ACCOUNTANT')
  async cancelRequest(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user?: { id?: number; sub?: number } },
  ) {
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.salaryRequestService.cancel(id, userId, true);
  }
}
