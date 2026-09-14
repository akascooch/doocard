import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminPersonalController } from './admin-personal.controller';
import { AdminPersonalService } from './admin-personal.service';
import { FrogRecurrenceScheduler } from './frog-recurrence.scheduler';

@Module({
  imports: [PrismaModule],
  controllers: [AdminPersonalController],
  providers: [AdminPersonalService, FrogRecurrenceScheduler],
})
export class AdminPersonalModule {}
