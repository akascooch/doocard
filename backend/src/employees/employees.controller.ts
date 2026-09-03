import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AssignServicesToEmployeeDto } from './dto/employee-service.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Public } from '../common/decorators/public.decorator';

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles('ADMIN')
  create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeesService.create(createEmployeeDto);
  }

  @Get()
  @Roles('ADMIN', 'EMPLOYEE', 'CUSTOMER')
  findAll() {
    return this.employeesService.findAll();
  }

  // Public endpoint to list active employees for registration page
  @Public()
  @Get('public/active')
  findAllActivePublic() {
    return this.employeesService.findAllActivePublic();
  }

  @Get('service-staff/active')
  @Roles('ADMIN', 'ACCOUNTANT')
  findActiveServiceStaff() {
    return this.employeesService.findActiveServiceStaff();
  }

  @Get('search')
  @Roles('ADMIN', 'EMPLOYEE')
  search(@Query('q') query: string) {
    return this.employeesService.searchEmployees(query);
  }

  // Employee-Service relationship endpoints - PUBLIC for booking page
  @Public()
  @Get('by-service/:serviceId')
  getEmployeesByService(@Param('serviceId', ParseIntPipe) serviceId: number) {
    console.log(`🔍 GET /employees/by-service/${serviceId} (PUBLIC)`);
    return this.employeesService.getEmployeesByService(serviceId);
  }

  @Get(':id')
  @Roles('ADMIN', 'EMPLOYEE')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.findOne(id);
  }

  @Get(':id/stats')
  @Roles('ADMIN', 'EMPLOYEE')
  getStats(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.getEmployeeStats(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateEmployeeDto: UpdateEmployeeDto) {
    return this.employeesService.update(id, updateEmployeeDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.remove(id);
  }

  @Get(':id/services')
  @Roles('ADMIN', 'EMPLOYEE')
  getEmployeeServices(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.getEmployeeServices(id);
  }

  @Post(':id/services')
  @Roles('ADMIN')
  assignServicesToEmployee(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignServicesDto: AssignServicesToEmployeeDto
  ) {
    console.log(`🎯 POST /employees/${id}/services - Controller reached`);
    console.log(`Request body:`, assignServicesDto);
    return this.employeesService.assignServicesToEmployee(id, assignServicesDto);
  }

  @Delete(':id/services/:serviceId')
  @Roles('ADMIN')
  removeServiceFromEmployee(
    @Param('id', ParseIntPipe) id: number,
    @Param('serviceId', ParseIntPipe) serviceId: number
  ) {
    return this.employeesService.removeServiceFromEmployee(id, serviceId);
  }
}