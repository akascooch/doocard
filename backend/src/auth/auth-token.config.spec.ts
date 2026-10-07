import appConfig from '../config/config';
import {
  DEFAULT_JWT_EXPIRES_IN,
  DEFAULT_JWT_REFRESH_EXPIRES_IN,
  REMEMBER_ME_REFRESH_TTL,
  getRefreshTokenExpiresAt,
} from './auth-token.config';

describe('auth token TTL defaults', () => {
  const previousRefresh = process.env.JWT_REFRESH_EXPIRES_IN;
  const previousAccess = process.env.JWT_EXPIRES_IN;

  afterEach(() => {
    if (previousRefresh === undefined) delete process.env.JWT_REFRESH_EXPIRES_IN;
    else process.env.JWT_REFRESH_EXPIRES_IN = previousRefresh;
    if (previousAccess === undefined) delete process.env.JWT_EXPIRES_IN;
    else process.env.JWT_EXPIRES_IN = previousAccess;
  });

  it('keeps access at 24h, refresh default at 30d, and staff rememberMe at 90d', () => {
    expect(DEFAULT_JWT_EXPIRES_IN).toBe('24h');
    expect(DEFAULT_JWT_REFRESH_EXPIRES_IN).toBe('30d');
    expect(REMEMBER_ME_REFRESH_TTL).toBe('90d');
  });

  it('uses the same refresh default in config.ts when the env var is unset', () => {
    delete process.env.JWT_REFRESH_EXPIRES_IN;
    delete process.env.JWT_EXPIRES_IN;
    const loaded = (appConfig as unknown as () => {
      jwt: { expiresIn: string; refreshExpiresIn: string };
    })();
    expect(loaded.jwt.expiresIn).toBe(DEFAULT_JWT_EXPIRES_IN);
    expect(loaded.jwt.refreshExpiresIn).toBe(DEFAULT_JWT_REFRESH_EXPIRES_IN);
  });

  it('sets a new refresh expiry about 30 days out when config has no override', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const config = { get: () => undefined } as never;
    const expiresAt = getRefreshTokenExpiresAt(config, from);
    expect(expiresAt.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });
});
