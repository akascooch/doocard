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
    console.log('📝 POST /appointments - User:', req.user?.phone, 'Data:', dto);
    return this.service.create(dto, req.user);
  }

  /**
   * Get appointments with filters (query params)
   */
  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN', 'EMPLOYEE', 'CUSTOMER')
  findAll(@Query() query: QueryAppointmentsDto, @Req() req: any) {
    console.log('🔍 GET /appointments - User:', req.user?.phone, 'Query:', query);
    return this.service.findAll(query, req.user);
  }

  /**
   * Get available time slots (public; optional JWT for staff slot override)
   */
  @Get('slots')
  @UseGuards(OptionalJwtAuthGuard)
  getSlots(@Query() dto: GetSlotsDto, @Req() req: any) {
    console.log('🕐 GET /appointments/slots - Query:', dto, 'User:', req.user?.role ?? 'anonymous');
    return this.service.getAvailableSlots(dto, req.user);
  }

  /**
   * Get earliest available slot (PUBLIC - for "اولین نوبت ممکن")
   * Iterates from today (Asia/Tehran) up to 30 days, reuses getAvailableSlots.
   */
  @Get('earliest')
  getEarliest(@Query() dto: GetEarliestDto) {
    console.log('🕐 GET /appointments/earliest (PUBLIC) - Query:', dto);
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
   * Get single appointment by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN', 'EMPLOYEE', 'CUSTOMER')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    console.log('🔍 GET /appointments/:id - User:', req.user?.phone, 'ID:', id);
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
    console.log('✏️  PATCH /appointments/:id - User:', req.user?.phone, 'ID:', id, 'Data:', dto);
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
    console.log('💰 POST /appointments/:id/settle - Admin:', req.user?.phone, 'ID:', id, 'Data:', dto);
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
    console.log('↩️ POST /appointments/:id/revert-settlement - Admin:', req.user?.phone, 'ID:', id);
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
    console.log('🚫 POST /appointments/:id/cancel - User:', req.user?.phone, 'ID:', id);
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
    console.log('✅ POST /appointments/:id/confirm - User:', req.user?.phone, 'ID:', id);
    return this.service.confirm(id, req.user);
  }

  /**
   * Delete (soft delete) appointment
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    console.log('🗑️  DELETE /appointments/:id - ID:', id);
    return this.service.remove(id);
  }

  /**
   * Get employee calendar (appointments + blocked times)
   */
  @Get('employees/:employeeId/calendar')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN', 'EMPLOYEE')
  getEmployeeCalendar(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    console.log('📅 GET /appointments/employees/:employeeId/calendar');
    return this.service.getEmployeeCalendar(employeeId, from, to);
  }

  /**
   * Create blocked time (ADMIN only)
   */
  @Post('employees/:employeeId/blocked-times')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN')
  createBlockedTime(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Body() data: { startAt: string; endAt: string; reason?: string },
    @Req() req: any,
  ) {
    console.log('🚫 POST /appointments/employees/:employeeId/blocked-times');
    return this.service.createBlockedTime({
      ...data,
      employeeId,
      createdBy: req.user?.sub || req.user?.id,
    });
  }

  /**
   * Get employee blocked times
   */
  @Get('employees/:employeeId/blocked-times')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN', 'EMPLOYEE')
  getBlockedTimes(@Param('employeeId', ParseIntPipe) employeeId: number) {
    console.log('🔍 GET /appointments/employees/:employeeId/blocked-times');
    return this.service.getBlockedTimes(employeeId);
  }

  /**
   * Delete blocked time
   */
  @Delete('blocked-times/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN')
  deleteBlockedTime(@Param('id', ParseIntPipe) id: number) {
    console.log('🗑️  DELETE /appointments/blocked-times/:id');
    return this.service.deleteBlockedTime(id);
  }
}
