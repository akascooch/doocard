import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateHomepageDetailsDto {
  @IsOptional()
  @IsString()
  about?: string;

  @IsOptional()
  @IsString()
  team?: string;

  @IsOptional()
  @IsString()
  products?: string;

  @IsOptional()
  @IsString()
  trainings?: string;

  @IsOptional()
  @IsString()
  testimonials?: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  heroTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  heroSubtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  instagramUrl?: string;

  @IsOptional()
  @IsString()
  workingHours?: string;
}

export class CreateLandingSlideDto {
  @IsString()
  @MaxLength(500)
  imageUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  subtitle?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLandingSlideDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  subtitle?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLandingStaffDto {
  @IsOptional()
  @IsBoolean()
  showOnLanding?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  bio?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  landingSortOrder?: number;
}
