import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum ManualInventoryMovementType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUSTMENT = 'ADJUSTMENT',
}

export class CreateInventoryMovementDto {
  @IsEnum(ManualInventoryMovementType, { message: 'نوع حرکت نامعتبر است' })
  type: ManualInventoryMovementType;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitCostRial?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
