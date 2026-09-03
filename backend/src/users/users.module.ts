import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CustomerRegistrationSmsModule } from '../sms/customer-registration-sms.module';

@Module({
  imports: [CustomerRegistrationSmsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
