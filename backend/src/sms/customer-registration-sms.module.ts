import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { FarazEdgeAdapter } from './adapters/faraz-edge.adapter';
import { CustomerRegistrationSmsService } from './customer-registration-sms.service';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [FarazEdgeAdapter, CustomerRegistrationSmsService],
  exports: [CustomerRegistrationSmsService],
})
export class CustomerRegistrationSmsModule {}
