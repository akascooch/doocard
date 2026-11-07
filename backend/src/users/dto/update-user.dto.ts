import { PartialType } from '@nestjs/mapped-types';
import { UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsNumber, IsString } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsNumber()
  salaryPercentage?: number | string;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  createdAt?: Date;

  @IsOptional()
  updatedAt?: Date;
} 