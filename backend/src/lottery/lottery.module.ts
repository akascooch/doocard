import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LotteryService } from './lottery.service';
import { LotteryCronService } from './lottery-cron.service';
import { LotteryAdminController, LotteryStaffController } from './lottery.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LotteryAdminController, LotteryStaffController],
  providers: [LotteryService, LotteryCronService],
  exports: [LotteryService],
})
export class LotteryModule {}
