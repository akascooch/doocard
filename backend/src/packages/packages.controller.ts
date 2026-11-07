import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
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
  listAssigned(
    @Query('customerId') customerId?: string,
    @Req() req?: { user?: { id?: number; sub?: number; role?: string } },
  ) {
    const id = Number(customerId);
    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException('شناسه مشتری نامعتبر است');
    }
    return this.service.listCustomerPackages(id, req?.user);
  }

  @Get('visible-active')
  @Roles('EMPLOYEE', 'SERVICE')
  visibleActive(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: { user?: { id?: number; sub?: number; role?: string } },
  ) {
    return this.service.listVisibleActiveHolders(
      req?.user || {},
      Number(page) || 1,
      Number(pageSize) || 20,
    );
  }

  @Get('visible-history')
  @Roles('EMPLOYEE', 'SERVICE')
  visibleHistory(
    @Query('customerId') customerId?: string,
    @Req() req?: { user?: { id?: number; sub?: number; role?: string } },
  ) {
    const id = Number(customerId);
    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException('شناسه مشتری نامعتبر است');
    }
    return this.service.listVisiblePackageHistory(req?.user || {}, id);
  }

  @Get('history')
  @Roles('ADMIN')
  history(
    @Query('customerId') customerId?: string,
    @Query('customerPackageId') customerPackageId?: string,
  ) {
    const id = Number(customerId);
    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException('شناسه مشتری نامعتبر است');
    }
    return this.service.listConsumptionHistory(id, customerPackageId || undefined);
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
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'EMPLOYEE', 'SERVICE')
  assign(@Body() dto: AssignPackageDto) {
    return this.service.assignPackage(dto);
  }

  @Get('my-packages')
  @Roles('CUSTOMER')
  myPackages(@Req() req: { user: { id: number } }) {
    return this.service.myPackages(req.user.id);
  }

  @Post(':id/consume')
  @Roles('ADMIN', 'EMPLOYEE', 'SERVICE')
  consume(
    @Param('id') id: string,
    @Body() dto: ConsumePackageDto,
    @Req() req: { user?: { id?: number; sub?: number } },
  ) {
    const actorId = Number(req.user?.id ?? req.user?.sub) || null;
    return this.service.consumePackageSession(id, dto, actorId);
  }
}
