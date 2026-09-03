import {
  Body,
  Controller,
  ForbiddenException,
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
import { EmployeeSalaryService } from '../admin/employee-salary.service';
import { EmployeeSalaryRequestService } from '../admin/employee-salary-request.service';
import { EmployeeSalaryPreviewQueryDto } from './dto/employee-salary-preview-query.dto';
import { CreateMySalaryRequestDto } from './dto/create-my-salary-request.dto';
import { buildSalaryBreakdownFromPreview } from '../common/dto/salary-breakdown.dto';

@Controller('employees/me')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeeSalaryRequestController {
  constructor(
    private readonly employeeSalaryService: EmployeeSalaryService,
    private readonly salaryRequestService: EmployeeSalaryRequestService,
  ) {}

  @Get('salary-request/preview')
  @Roles('EMPLOYEE', 'SERVICE')
  async preview(
    @Query() query: EmployeeSalaryPreviewQueryDto,
    @Req() req: { user?: { id?: number } },
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    const preview = await this.employeeSalaryService.previewForAuthenticatedEmployee(
      userId,
      query.from,
      query.to,
    );
    return {
      ...preview,
      breakdown: buildSalaryBreakdownFromPreview(preview),
    };
  }

  @Get('salary-summary')
  @Roles('EMPLOYEE', 'SERVICE')
  async summary(
    @Query() query: EmployeeSalaryPreviewQueryDto,
    @Req() req: { user?: { id?: number } },
  ) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.salaryRequestService.summaryForAuthenticatedUser(
      userId,
      query.from,
      query.to,
    );
  }

  @Get('salary-requests')
  @Roles('EMPLOYEE', 'SERVICE')
  async listMine(@Req() req: { user?: { id?: number } }) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.salaryRequestService.listMine(userId);
  }

  @Post('salary-requests')
  @Roles('EMPLOYEE', 'SERVICE')
  async create(
    @Body() body: CreateMySalaryRequestDto,
    @Req() req: { user?: { id?: number } },
  ) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.salaryRequestService.createForAuthenticatedUser(userId, body);
  }

  @Post('salary-requests/:id/cancel')
  @Roles('EMPLOYEE', 'SERVICE')
  async cancelMine(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user?: { id?: number } },
  ) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.salaryRequestService.cancel(id, userId, false);
  }
}
