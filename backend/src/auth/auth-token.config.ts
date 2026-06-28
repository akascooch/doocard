import { ConfigService } from '@nestjs/config';
import { addTtlToDate, parseTtlToMilliseconds } from '../common/utils/ttl.util';

export const DEFAULT_JWT_EXPIRES_IN = '24h';
export const DEFAULT_JWT_REFRESH_EXPIRES_IN = '365d';

const FALLBACK_ACCESS_MS = parseTtlToMilliseconds(DEFAULT_JWT_EXPIRES_IN, 24 * 60 * 60 * 1000);
const FALLBACK_REFRESH_MS = parseTtlToMilliseconds(
  DEFAULT_JWT_REFRESH_EXPIRES_IN,
  365 * 24 * 60 * 60 * 1000,
);

export function getJwtAccessExpiresIn(config: ConfigService): string {
  return config.get<string>('JWT_EXPIRES_IN') || DEFAULT_JWT_EXPIRES_IN;
}

export function getJwtRefreshExpiresIn(config: ConfigService): string {
  return config.get<string>('JWT_REFRESH_EXPIRES_IN') || DEFAULT_JWT_REFRESH_EXPIRES_IN;
}

export function getAccessCookieMaxAgeMs(config: ConfigService): number {
  return parseTtlToMilliseconds(getJwtAccessExpiresIn(config), FALLBACK_ACCESS_MS);
}

export function getRefreshCookieMaxAgeMs(config: ConfigService): number {
  return parseTtlToMilliseconds(getJwtRefreshExpiresIn(config), FALLBACK_REFRESH_MS);
}

export function getRefreshTokenExpiresAt(config: ConfigService, from = new Date()): Date {
  return addTtlToDate(getJwtRefreshExpiresIn(config), FALLBACK_REFRESH_MS, from);
}
