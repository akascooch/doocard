import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { ClientErrorsController } from './client-errors.controller';
import { AppThrottlerModule } from '../throttler/throttler.module';

@Module({
  imports: [ConfigModule, AppThrottlerModule],
  controllers: [MonitoringController, ClientErrorsController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
