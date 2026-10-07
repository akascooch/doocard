import { PrismaClient } from '@prisma/client';

export class IntegrationHarnessError extends Error {
  readonly code = 'INTEGRATION_HARNESS';

  constructor(message: string) {
    super(message);
    this.name = 'IntegrationHarnessError';
  }
}

/**
 * Accept only an explicit local test database. Never fall back to DATABASE_URL.
 * This function does not open a connection.
 */
export function assertIsolatedTestDatabaseUrl(raw: string | undefined): string {
  if (!raw) {
    throw new IntegrationHarnessError(
      'INTEGRATION_SKIPPED: TEST_DATABASE_URL is not set. No database connection was opened.',
    );
  }
  if (process.env.DATABASE_URL && raw === process.env.DATABASE_URL) {
    throw new IntegrationHarnessError(
      'INTEGRATION_SKIPPED: TEST_DATABASE_URL must not equal DATABASE_URL.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new IntegrationHarnessError('INTEGRATION_SKIPPED: TEST_DATABASE_URL is not a valid URL.');
  }

  const host = parsed.hostname;
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new IntegrationHarnessError(
      'INTEGRATION_SKIPPED: the database host must be 127.0.0.1 or localhost.',
    );
  }
  if (!/(^|_)test($|_)|test/i.test(databaseName)) {
    throw new IntegrationHarnessError(
      'INTEGRATION_SKIPPED: the database name must contain "test".',
    );
  }
  return raw;
}

/**
 * Prisma client for integration specs. Construction validates the URL and does
 * not connect. Connecting happens only in onModuleInit, and only outside dry-run.
 * resetDatabase truncates public tables only after the URL checks pass and
 * current_database() matches that isolated test database. _prisma_migrations
 * is left in place. Dry-run does not connect or delete.
 */
export class PrismaTestService extends PrismaClient {
  private static loggedTarget = false;

  constructor() {
    const dryRun = process.env.INTEGRATION_DRY_RUN === '1';
    const url = dryRun
      ? assertIsolatedTestDatabaseUrl(
          process.env.TEST_DATABASE_URL ||
            'postgresql://prisma:disabled@127.0.0.1:5432/doocard_test?schema=public',
        )
      : assertIsolatedTestDatabaseUrl(process.env.TEST_DATABASE_URL);
    super({ datasources: { db: { url } } });
  }

  async onModuleInit(): Promise<void> {
    if (process.env.INTEGRATION_DRY_RUN === '1') {
      return;
    }
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (process.env.INTEGRATION_DRY_RUN === '1') {
      return;
    }
    await this.$disconnect();
  }

  async resetDatabase(): Promise<void> {
    const url = assertIsolatedTestDatabaseUrl(process.env.TEST_DATABASE_URL || (
      process.env.INTEGRATION_DRY_RUN === '1'
        ? 'postgresql://prisma:disabled@127.0.0.1:5432/doocard_test?schema=public'
        : undefined
    ));
    if (process.env.INTEGRATION_DRY_RUN === '1') {
      return;
    }

    const expectedName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
    const current = await this.$queryRaw<Array<{ current_database: string }>>`
      SELECT current_database()
    `;
    const actual = current[0]?.current_database;
    if (!actual || actual !== expectedName || !/test/i.test(actual)) {
      throw new IntegrationHarnessError(
        'INTEGRATION_SKIPPED: connected database does not match the isolated test database. No rows were deleted.',
      );
    }
    if (!PrismaTestService.loggedTarget) {
      console.log(`PrismaTestService isolated database: ${actual}`);
      PrismaTestService.loggedTarget = true;
    }

    const tables = await this.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> '_prisma_migrations'
    `;
    const names = tables.map((row) => row.tablename);
    if (names.some((name) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))) {
      throw new IntegrationHarnessError(
        'INTEGRATION_SKIPPED: unexpected table name. No rows were deleted.',
      );
    }
    if (names.length === 0) {
      return;
    }

    const list = names.map((name) => `"${name}"`).join(', ');
    await this.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
}
