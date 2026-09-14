import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LoyaltyAdminController } from './loyalty.admin.controller';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';

@Module({
  imports: [PrismaModule],
  controllers: [LoyaltyController, LoyaltyAdminController],
  providers: [LoyaltyService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
