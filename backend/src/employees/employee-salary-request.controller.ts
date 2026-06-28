import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { EmployeeSalaryService } from '../admin/employee-salary.service';
import { EmployeeSalaryPreviewQueryDto } from './dto/employee-salary-preview-query.dto';

@Controller('employees/me/salary-request')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeeSalaryRequestController {
  constructor(private readonly employeeSalaryService: EmployeeSalaryService) {}

  @Get('preview')
  @Roles('EMPLOYEE')
  async preview(
    @Query() query: EmployeeSalaryPreviewQueryDto,
    @Req() req: { user?: { id?: number } },
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    return this.employeeSalaryService.previewForAuthenticatedEmployee(
      userId,
      query.from,
      query.to,
    );
  }
}
