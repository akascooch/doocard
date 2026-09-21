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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  /**
   * Create new appointment
   */
  @Post()
  @UseGuards(JwtAuthGuard, PermissionGuard, ThrottlerGuard)
  @Roles('ADMIN', 'EMPLOYEE', 'CUSTOMER')
  @Throttle({ short: { limit: 12, ttl: 60_000 } })
  create(@Body() dto: CreateAppointmentDto, @Req() req: any) {
    return this.service.create(dto, req.user);
  }

  /**
   * Get appointments with filters (query params)
   */
  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN', 'EMPLOYEE', 'CUSTOMER')
  findAll(@Query() query: QueryAppointmentsDto, @Req() req: any) {
    return this.service.findAll(query, req.user);
  }

  /**
   * Get available time slots (public; optional JWT for staff slot override)
   */
  @Get('slots')
  @UseGuards(OptionalJwtAuthGuard)
  getSlots(@Query() dto: GetSlotsDto, @Req() req: any) {
    return this.service.getAvailableSlots(dto, req.user);
  }

  /**
   * Get earliest available slot (PUBLIC - for "اولین نوبت ممکن")
   * Iterates from today (Asia/Tehran) up to 30 days, reuses getAvailableSlots.
   */
  @Get('earliest')
  getEarliest(@Query() dto: GetEarliestDto) {
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
    return this.service.getSummary(query, req.user);
  }

  /**
   * Get single appointment by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN', 'EMPLOYEE', 'CUSTOMER')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.findOne(id, req.user);
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
    return this.service.update(id, dto, req.user);
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
    return this.service.remove(id, req.user);
  }
}
