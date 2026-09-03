import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UploadImportDto } from './upload-import.dto';

/**
 * Parse multipart text fields for import upload.
 * The binary `file` field is handled by FileInterceptor / @UploadedFile — not the DTO.
 */
export async function parseUploadImportBody(
  body: Record<string, unknown> | undefined,
): Promise<UploadImportDto> {
  const { file: _file, ...rest } = body ?? {};
  const dto = plainToInstance(UploadImportDto, rest, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length > 0) {
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    throw new BadRequestException(messages.join('; ') || 'داده‌های فرم نامعتبر است');
  }
  return dto;
}
