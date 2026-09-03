import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  validateSync,
} from 'class-validator';
import { parseTtlToMilliseconds } from '../common/utils/ttl.util';

const JWT_TTL_PATTERN = /^(\d+[smhd]|\d+)$/i;
const POSTGRES_URL_PATTERN = /^postgresql:\/\/.+/i;

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  @Matches(POSTGRES_URL_PATTERN, {
    message: 'DATABASE_URL must be a valid PostgreSQL connection URL',
  })
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_REFRESH_SECRET must be at least 32 characters' })
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @Matches(JWT_TTL_PATTERN, {
    message: 'JWT_EXPIRES_IN must be a duration like 15m, 24h, or 7d',
  })
  JWT_EXPIRES_IN!: string;

  @IsString()
  @Matches(JWT_TTL_PATTERN, {
    message: 'JWT_REFRESH_EXPIRES_IN must be a duration like 7d or 365d',
  })
  JWT_REFRESH_EXPIRES_IN!: string;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN!: string;

  @IsString()
  @IsNotEmpty()
  FRONTEND_URL!: string;

  @IsIn(['development', 'production', 'test'])
  NODE_ENV!: 'development' | 'production' | 'test';
}

function assertRefreshTtlNotShorterThanAccess(config: EnvironmentVariables): void {
  const accessMs = parseTtlToMilliseconds(config.JWT_EXPIRES_IN, 0);
  const refreshMs = parseTtlToMilliseconds(config.JWT_REFRESH_EXPIRES_IN, 0);

  if (accessMs <= 0 || refreshMs <= 0) {
    throw new Error('JWT_EXPIRES_IN and JWT_REFRESH_EXPIRES_IN must be valid positive durations');
  }

  if (refreshMs < accessMs) {
    throw new Error(
      'JWT_REFRESH_EXPIRES_IN must be greater than or equal to JWT_EXPIRES_IN',
    );
  }
}

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: true,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .filter(Boolean)
      .join('; ');
    throw new Error(`Environment validation failed: ${details}`);
  }

  assertRefreshTtlNotShorterThanAccess(validated);

  return validated;
}
