import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Patch,
  ParseIntPipe,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { 
  CreateAppointmentDto, 
  UpdateAppointmentDto,
  SettleAppointmentDto,
  GetSlotsDto,
  GetEarliestDto,
  QueryAppointmentsDto
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';

function actorLog(user: any): string {
  const id = user?.sub ?? user?.id ?? user?.userId ?? '?';
  const role = user?.role ?? '?';
  return `userId=${id} role=${role}`;
}

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  /**
   * Create new appointment
   */
  @Post()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN', 'EMPLOYEE', 'CUSTOMER')
  create(@Body() dto: CreateAppointmentDto, @Req() req: any) {
    console.log('📝 POST /appointments -', actorLog(req.user), 'services=', dto?.services?.length);
    return this.service.create(dto, req.user);
  }

  /**
   * Get appointments with filters (query params)
   */
  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN', 'EMPLOYEE', 'CUSTOMER')
  findAll(@Query() query: QueryAppointmentsDto, @Req() req: any) {
    console.log('🔍 GET /appointments -', actorLog(req.user));
    return this.service.findAll(query, req.user);
  }

  /**
   * Get available time slots (public; optional JWT for staff slot override)
   */
  @Get('slots')
  @UseGuards(OptionalJwtAuthGuard)
  getSlots(@Query() dto: GetSlotsDto, @Req() req: any) {
    console.log('🕐 GET /appointments/slots - role:', req.user?.role ?? 'anonymous');
    return this.service.getAvailableSlots(dto, req.user);
  }

  /**
   * Get earliest available slot (PUBLIC - for "اولین نوبت ممکن")
   * Iterates from today (Asia/Tehran) up to 30 days, reuses getAvailableSlots.
   */
  @Get('earliest')
  getEarliest(@Query() dto: GetEarliestDto) {
    console.log('🕐 GET /appointments/earliest (PUBLIC)');
    return this.service.getEarliestAvailableSlot(dto.employeeId, dto.serviceId);
  }

  /**
   * Get customer appointment history
   */
  @Get('customer-history')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('CUSTOMER')
  getCustomerHistory(@Req() req: any) {
    return this.service.getCustomerHistory(req.user);
  }

  /**
   * Daily tip stats from settled appointments (for accounting daily-tips UI).
   */
  @Get('tip-daily-stats')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN', 'ACCOUNTANT')
  getDailyTipStats(@Query('date') date: string) {
    if (!date) {
      throw new BadRequestException('date query param is required (YYYY-MM-DD)');
    }
    return this.service.getDailyTipStats(date);
  }

  /**
   * Aggregated counts + settled sales for current filters (full population, not paginated).
   */
  @Get('summary')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN', 'EMPLOYEE', 'CUSTOMER')
  getSummary(@Query() query: QueryAppointmentsDto, @Req() req: any) {
    console.log('📊 GET /appointments/summary -', actorLog(req.user));
    return this.service.getSummary(query, req.user);
  }

  /**
   * Get single appointment by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN', 'EMPLOYEE', 'CUSTOMER')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    console.log('🔍 GET /appointments/:id -', actorLog(req.user), 'id=', id);
    return this.service.findOne(id);
  }

  /**
   * Update appointment
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN', 'EMPLOYEE')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppointmentDto,
    @Req() req: any
  ) {
    console.log('✏️  PATCH /appointments/:id -', actorLog(req.user), 'id=', id);
    return this.service.update(id, dto);
  }

  /**
   * Settle appointment (create accounting transactions) - ADMIN ONLY
   */
  @Post(':id/settle')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN', 'ACCOUNTANT')
  @HttpCode(HttpStatus.OK)
  settle(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SettleAppointmentDto,
    @Req() req: any
  ) {
    console.log('💰 POST /appointments/:id/settle -', actorLog(req.user), 'id=', id);
    return this.service.settle(id, dto, req.user);
  }

  /**
   * Revert settlement (ADMIN only) - undo settlement so appointment can be deleted
   */
  @Post(':id/revert-settlement')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  revertSettlement(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    console.log('↩️ POST /appointments/:id/revert-settlement -', actorLog(req.user), 'id=', id);
    return this.service.revertSettlement(id, req.user);
  }

  /**
   * Cancel appointment
   */
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN', 'EMPLOYEE', 'CUSTOMER')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    console.log('🚫 POST /appointments/:id/cancel -', actorLog(req.user), 'id=', id);
    return this.service.cancel(id, req.user);
  }

  /**
   * Confirm appointment (EMPLOYEE/ADMIN only)
   */
  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN', 'EMPLOYEE')
  @HttpCode(HttpStatus.OK)
  confirm(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    console.log('✅ POST /appointments/:id/confirm -', actorLog(req.user), 'id=', id);
    return this.service.confirm(id, req.user);
  }

  /**
   * Delete (soft delete) appointment
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN', 'EMPLOYEE')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    console.log('🗑️ DELETE /appointments/:id -', actorLog(req.user), 'id=', id);
    return this.service.remove(id);
  }
}
