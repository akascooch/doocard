import { IsString, MinLength } from 'class-validator';

export class VerifyFinancialAccessDto {
  @IsString()
  @MinLength(1)
  password: string;
}
