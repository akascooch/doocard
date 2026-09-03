import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomerDto } from './create-customer.dto';
import { IsInt, IsOptional, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  /** null clears preferred barber (UI: تیم سالن). */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  preferredEmployeeId?: number | null;
}
