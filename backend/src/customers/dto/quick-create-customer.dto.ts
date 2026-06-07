import { IsString, MinLength } from 'class-validator';

export class QuickCreateCustomerDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  phone: string;
}
