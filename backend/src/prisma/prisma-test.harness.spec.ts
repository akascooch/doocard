import {
  assertIsolatedTestDatabaseUrl,
  IntegrationHarnessError,
} from '../../tests/prisma-test.service';

describe('isolated test database URL', () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  it('refuses a missing URL without reading a fallback', () => {
    process.env.DATABASE_URL = 'postgresql://postgres:change-me@127.0.0.1:5432/doocard?schema=public';
    expect(() => assertIsolatedTestDatabaseUrl(undefined)).toThrow(IntegrationHarnessError);
    expect(() => assertIsolatedTestDatabaseUrl(undefined)).toThrow(/INTEGRATION_SKIPPED/);
  });

  it('refuses a non-local host and a database name that is not a test database', () => {
    expect(() =>
      assertIsolatedTestDatabaseUrl('postgresql://postgres:change-me@db.example.com:5432/doocard_test'),
    ).toThrow(/127\.0\.0\.1 or localhost/);
    expect(() =>
      assertIsolatedTestDatabaseUrl('postgresql://postgres:change-me@127.0.0.1:5432/doocard'),
    ).toThrow(/must contain "test"/);
  });

  it('accepts a loopback database whose name contains test', () => {
    const url = 'postgresql://postgres:change-me@127.0.0.1:5432/doocard_test?schema=public';
    expect(assertIsolatedTestDatabaseUrl(url)).toBe(url);
  });
});
