import { ConfigService } from '@nestjs/config';

export function parseOriginList(value?: string | null): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Same allow-list as HTTP CORS in main.ts.
 * Does not widen beyond ALLOWED_ORIGINS / CORS_ORIGIN / FRONTEND_URL.
 */
export function resolveCorsOriginsFromEnv(
  env: Record<string, string | undefined>,
): string[] {
  const origins = new Set<string>();
  for (const origin of parseOriginList(env.ALLOWED_ORIGINS)) origins.add(origin);
  for (const origin of parseOriginList(env.CORS_ORIGIN)) origins.add(origin);
  const frontendUrl = env.FRONTEND_URL?.trim();
  if (frontendUrl) origins.add(frontendUrl);
  if (origins.size === 0) {
    origins.add('http://localhost:3000');
    origins.add('http://localhost:3001');
  }
  return [...origins];
}

export function resolveCorsOrigins(configService: ConfigService): string[] {
  return resolveCorsOriginsFromEnv({
    ALLOWED_ORIGINS: configService.get<string>('ALLOWED_ORIGINS'),
    CORS_ORIGIN: configService.get<string>('CORS_ORIGIN'),
    FRONTEND_URL: configService.get<string>('FRONTEND_URL'),
  });
}
