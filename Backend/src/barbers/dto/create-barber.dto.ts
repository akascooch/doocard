import { IsString, IsEmail, IsOptional, IsArray, IsNumber } from 'class-validator';

export class CreateBarberDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  serviceIds?: number[];
} 