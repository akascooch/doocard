import { ConfigService } from '@nestjs/config';
import { addTtlToDate, parseTtlToMilliseconds } from '../common/utils/ttl.util';

export const DEFAULT_JWT_EXPIRES_IN = '24h';
export const DEFAULT_JWT_REFRESH_EXPIRES_IN = '365d';
export const REMEMBER_ME_REFRESH_TTL = '90d';
export const STAFF_REMEMBER_ROLES = [
  'ADMIN',
  'MANAGER',
  'ACCOUNTANT',
  'EMPLOYEE',
  'SERVICE',
] as const;

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

const FALLBACK_REMEMBER_MS = parseTtlToMilliseconds(REMEMBER_ME_REFRESH_TTL, 90 * 24 * 60 * 60 * 1000);

export function shouldApplyRememberMe(role: string | undefined, rememberMe?: boolean): boolean {
  if (!rememberMe || !role) return false;
  return (STAFF_REMEMBER_ROLES as readonly string[]).includes(role);
}

export function getRememberMeRefreshExpiresAt(from = new Date()): Date {
  return addTtlToDate(REMEMBER_ME_REFRESH_TTL, FALLBACK_REMEMBER_MS, from);
}

export function getRememberMeCookieMaxAgeMs(): number {
  return FALLBACK_REMEMBER_MS;
}
