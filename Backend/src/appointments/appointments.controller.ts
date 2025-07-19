import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Patch,
  ParseIntPipe
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Post()
  create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.service.create(createAppointmentDto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('barber/:barberId')
  findByBarber(@Param('barberId', ParseIntPipe) barberId: number) {
    return this.service.findByBarber(barberId);
  }

  @Get('customer/:customerId')
  findByCustomer(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.service.findByCustomer(customerId);
  }

  @Get('slots')
  getAvailableSlots(
    @Query('date') date: string,
    @Query('barberId', ParseIntPipe) barberId: number,
  ) {
    return this.service.getAvailableSlots(date, barberId);
  }

  @Get('barber/:barberId/appointments')
  getBarberAppointments(
    @Param('barberId', ParseIntPipe) barberId: number,
    @Query('date') date: string,
  ) {
    return this.service.getBarberAppointments(barberId, date);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateAppointmentDto: UpdateAppointmentDto) {
    return this.service.update(id, updateAppointmentDto);
  }

  @Post(':id/settle')
  settleAppointment(
    @Param('id', ParseIntPipe) id: number, 
    @Body() settleDto: { amount?: number; paymentMethod?: string }
  ) {
    return this.service.settleAppointment(id, settleDto);
  }

  @Post(':id/cancel-settled')
  cancelSettledAppointment(@Param('id', ParseIntPipe) id: number) {
    return this.service.cancelSettledAppointment(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
