import { IsString, IsOptional } from 'class-validator';

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
}
