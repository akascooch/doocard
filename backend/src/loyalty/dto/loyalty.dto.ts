import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class RedeemLoyaltyDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  points: number;
}

export class UpdateLoyaltySettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  loyaltyRateRialPerPoint?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  loyaltyMinRedeemPoints?: number;
}

export class AdjustLoyaltyDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerId: number;

  @Type(() => Number)
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  points: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  notes: string;
}
