import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  MAX_SESSIONS,
  MAX_VALIDITY_DAYS,
  PACKAGE_PAYMENTS,
  type PackagePayment,
} from '../packages.constants';

export class CreatePackageTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @Transform(({ value }) => (typeof value === 'number' ? String(value) : String(value ?? '').trim()))
  @IsString()
  @Matches(/^\d+$/, { message: 'قیمت باید عدد صحیح ریال باشد' })
  @MaxLength(14)
  priceRial: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_VALIDITY_DAYS)
  validityDays: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SESSIONS)
  totalSessions: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  serviceId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  pointsRequired?: number | null;
}

export class UpdatePackageTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'number' ? String(value) : String(value ?? '').trim()))
  @IsString()
  @Matches(/^\d+$/, { message: 'قیمت باید عدد صحیح ریال باشد' })
  @MaxLength(14)
  priceRial?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_VALIDITY_DAYS)
  validityDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SESSIONS)
  totalSessions?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  serviceId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  pointsRequired?: number | null;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive?: boolean;
}

export class AssignPackageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerId: number;

  @IsUUID()
  packageTemplateId: string;

  @IsIn(PACKAGE_PAYMENTS)
  paymentMethod: PackagePayment;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ConsumePackageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  appointmentId: number;
}
