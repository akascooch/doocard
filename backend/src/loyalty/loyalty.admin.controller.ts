import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { LoyaltyService } from './loyalty.service';
import { AdjustLoyaltyDto, UpdateLoyaltySettingsDto } from './dto/loyalty.dto';

@Controller('admin/loyalty')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class LoyaltyAdminController {
  constructor(private readonly service: LoyaltyService) {}

  @Get('settings')
  @Roles('ADMIN')
  getSettings() {
    return this.service.getLoyaltySettings();
  }

  @Patch('settings')
  @Roles('ADMIN')
  updateSettings(@Body() dto: UpdateLoyaltySettingsDto) {
    return this.service.updateLoyaltySettings(dto);
  }

  @Get('customer/:customerId')
  @Roles('ADMIN')
  snapshot(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.service.snapshot(customerId);
  }

  @Post('adjust-points')
  @Roles('ADMIN')
  adjust(@Body() dto: AdjustLoyaltyDto) {
    return this.service.adjustPoints(dto);
  }
}
