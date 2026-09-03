import { IsString, IsArray, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class SendSmsDto {
  @IsString()
  @IsNotEmpty()
  originator: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  recipients: string[];

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsInt()
  @IsOptional()
  appointmentId?: number;
}

export class QueueSmsJobDto {
  @IsInt()
  @IsNotEmpty()
  appointmentId: number;
}

