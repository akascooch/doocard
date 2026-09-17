import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateProductPackagingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  unitLabel: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  unitsPerPackage: number;
}

export class UpdateProductPackagingDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unitLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  unitsPerPackage?: number;
}

export class QueryKardexDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
