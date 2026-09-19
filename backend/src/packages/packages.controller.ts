import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PackagesService } from './packages.service';
import {
  AssignPackageDto,
  ConsumePackageDto,
  CreatePackageTemplateDto,
  UpdatePackageTemplateDto,
} from './dto/packages.dto';

@Controller('packages')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PackagesController {
  constructor(private readonly service: PackagesService) {}

  @Get('templates')
  @Roles('ADMIN')
  listTemplates() {
    return this.service.listTemplates();
  }

  @Post('templates')
  @Roles('ADMIN')
  createTemplate(@Body() dto: CreatePackageTemplateDto) {
    return this.service.createTemplate(dto);
  }

  @Patch('templates/:id')
  @Roles('ADMIN')
  updateTemplate(@Param('id') id: string, @Body() dto: UpdatePackageTemplateDto) {
    return this.service.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @Roles('ADMIN')
  deactivateTemplate(@Param('id') id: string) {
    return this.service.deactivateTemplate(id);
  }

  @Get('assigned')
  @Roles('ADMIN', 'EMPLOYEE', 'SERVICE')
  listAssigned(@Query('customerId') customerId?: string) {
    const id = Number(customerId);
    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException('شناسه مشتری نامعتبر است');
    }
    return this.service.listCustomerPackages(id);
  }

  @Get('eligible')
  @Roles('ADMIN', 'EMPLOYEE', 'SERVICE')
  eligible(@Query('appointmentId') appointmentId?: string) {
    const id = Number(appointmentId);
    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException('شناسه نوبت نامعتبر است');
    }
    return this.service.eligibleForAppointment(id);
  }

  @Get('eligible-batch')
  @Roles('ADMIN', 'EMPLOYEE', 'SERVICE')
  eligibleBatch(@Query('ids') ids?: string) {
    const parsed = String(ids || '')
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((id) => Number.isInteger(id) && id > 0);
    return this.service.eligibleForAppointments(parsed);
  }

  @Get('loyalty-eligible/:customerId')
  @Roles('ADMIN', 'EMPLOYEE', 'SERVICE')
  loyaltyEligible(@Param('customerId') customerId?: string) {
    const id = Number(customerId);
    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException('شناسه مشتری نامعتبر است');
    }
    return this.service.loyaltyEligibleForCustomer(id);
  }

  @Post('assign')
  @Roles('ADMIN', 'EMPLOYEE', 'SERVICE')
  assign(@Body() dto: AssignPackageDto) {
    return this.service.assignPackage(dto);
  }

  @Post(':id/consume')
  @Roles('ADMIN', 'EMPLOYEE', 'SERVICE')
  consume(@Param('id') id: string, @Body() dto: ConsumePackageDto) {
    return this.service.consumePackageSession(id, dto);
  }

  @Get('my-packages')
  @Roles('CUSTOMER')
  myPackages(@Req() req: { user: { id: number } }) {
    return this.service.myPackages(req.user.id);
  }
}
