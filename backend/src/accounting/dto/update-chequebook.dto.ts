import { PartialType } from '@nestjs/mapped-types';
import { CreateChequebookDto } from './create-chequebook.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateChequebookDto extends PartialType(CreateChequebookDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
