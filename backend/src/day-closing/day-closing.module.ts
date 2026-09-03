import { Module } from '@nestjs/common';
import { DayClosingController } from './day-closing.controller';
import { DayClosingService } from './day-closing.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DayClosingController],
  providers: [DayClosingService],
  exports: [DayClosingService],
})
export class DayClosingModule {}
