import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminPersonalController } from './admin-personal.controller';
import { AdminPersonalService } from './admin-personal.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminPersonalController],
  providers: [AdminPersonalService],
})
export class AdminPersonalModule {}
