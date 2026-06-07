import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ConflictException,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QuickCreateCustomerDto } from './dto/quick-create-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Roles as RolesDecorator } from '../auth/decorators/roles.decorator';

@Controller('customers')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Post()
  @Roles('ADMIN', 'EMPLOYEE')
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.service.create(createCustomerDto);
  }

  @Post('quick')
  @Roles('ADMIN', 'EMPLOYEE')
  async quickCreate(@Body() dto: QuickCreateCustomerDto) {
    return this.service.quickCreate(dto);
  }

  @Get()
  @Roles('ADMIN', 'EMPLOYEE')
  async findAll(@Query('search') search?: string, @Req() req?: any) {
    if (search) {
      return this.service.searchCustomers(search);
    }
    return this.service.findAll();
  }

  // Get current customer (simple) - MUST be before :id route
  @Get('me')
  @Roles('CUSTOMER')
  async getMe(@Req() req: any) {
    const currentUser = req.user;
    return this.service.getMyProfile(currentUser.id);
  }

  // Get current customer profile with preferred hairdresser
  @Get('me/profile')
  @Roles('CUSTOMER')
  async getMyProfile(@Req() req: any) {
    const currentUser = req.user;
    return this.service.getMyProfile(currentUser.id);
  }

  @Get('phone/:phone')
  @Roles('ADMIN', 'EMPLOYEE')
  async findByPhone(@Param('phone') phone: string) {
    return this.service.findByPhone(phone);
  }

  @Get(':id')
  @Roles('ADMIN', 'EMPLOYEE', 'CUSTOMER')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const currentUser = req.user;
    // اگر مشتری است، فقط اطلاعات خودش را ببیند
    if (currentUser.role === 'CUSTOMER' && currentUser.id !== id) {
      throw new Error('Unauthorized access');
    }
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'EMPLOYEE', 'CUSTOMER')
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateCustomerDto: UpdateCustomerDto, @Req() req: any) {
    const currentUser = req.user;
    // اگر مشتری است، فقط اطلاعات خودش را ویرایش کند
    if (currentUser.role === 'CUSTOMER' && currentUser.id !== id) {
      throw new Error('Unauthorized access');
    }
    if (updateCustomerDto.phone) {
      const existingCustomer = await this.service.findByPhone(updateCustomerDto.phone);
      if (existingCustomer && existingCustomer.id !== id) {
        throw new Error('شماره تلفن قبلاً ثبت شده است');
      }
    }
    return this.service.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'EMPLOYEE')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
} 