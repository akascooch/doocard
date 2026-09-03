import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { CustomersService } from '../customers/customers.service';

@Controller('admin/debtors')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AdminDebtorsController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles('ADMIN', 'ACCOUNTANT')
  async listDebtors() {
    return this.customersService.listDebtors();
  }
}
