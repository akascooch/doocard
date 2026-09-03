import { IsNotEmpty, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class GetEarliestDto {
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  employeeId: number;

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  serviceId: number;
}
