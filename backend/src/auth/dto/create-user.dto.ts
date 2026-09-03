import { IsString, IsEmail, IsEnum, IsOptional } from 'class-validator';
import { Role } from '../../common/enums';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  phoneNumber!: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;
} 