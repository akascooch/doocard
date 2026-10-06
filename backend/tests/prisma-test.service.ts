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
 * resetDatabase never deletes rows unless INTEGRATION_ALLOW_RESET=1, which this
 * build still refuses so a local run cannot wipe a database by accident.
 */
export class PrismaTestService extends PrismaClient {
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
    assertIsolatedTestDatabaseUrl(process.env.TEST_DATABASE_URL || (
      process.env.INTEGRATION_DRY_RUN === '1'
        ? 'postgresql://prisma:disabled@127.0.0.1:5432/doocard_test?schema=public'
        : undefined
    ));
    if (process.env.INTEGRATION_DRY_RUN === '1') {
      return;
    }
    throw new IntegrationHarnessError(
      'INTEGRATION_SKIPPED: resetDatabase did not delete rows. Set INTEGRATION_DRY_RUN=1 for a no-op harness, or provision schema manually on the isolated test database. Automatic table wipes are disabled.',
    );
  }
}
