import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { LoyaltyService } from './loyalty.service';
import { RedeemLoyaltyDto } from './dto/loyalty.dto';

@Controller('loyalty')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class LoyaltyController {
  constructor(private readonly service: LoyaltyService) {}

  @Get('me')
  @Roles('CUSTOMER')
  me(@Req() req: { user: { id: number } }) {
    return this.service.me(req.user.id);
  }

  @Post('redeem-to-wallet')
  @Roles('CUSTOMER')
  redeem(@Req() req: { user: { id: number } }, @Body() dto: RedeemLoyaltyDto) {
    return this.service.redeemToWallet(req.user.id, dto);
  }
}
