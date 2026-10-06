/**
 * Integration-test gate. Does not connect, migrate, seed, or reset a database.
 * Exit 0: TEST_DATABASE_URL passed isolation checks.
 * Exit 2: prerequisites missing (INTEGRATION_SKIPPED). Not a successful test run.
 * Exit 1: the URL is present but unsafe.
 */
import { assertIsolatedTestDatabaseUrl, IntegrationHarnessError } from '../tests/prisma-test.service';

function finish(error: unknown): never {
  const skipped = error instanceof IntegrationHarnessError;
  console.error(error instanceof Error ? error.message : 'Integration setup refused.');
  process.exit(skipped && /is not set|must not equal/.test(error instanceof Error ? error.message : '') ? 2 : 1);
}

try {
  if (process.env.INTEGRATION_DRY_RUN === '1' && !process.env.TEST_DATABASE_URL) {
    console.log(
      'INTEGRATION_DRY_RUN: no TEST_DATABASE_URL. The harness will not connect and resetDatabase is a no-op. This is not a database test run.',
    );
    process.exit(0);
  }
  assertIsolatedTestDatabaseUrl(process.env.TEST_DATABASE_URL);
  console.log(
    'Isolated TEST_DATABASE_URL accepted. No connection was opened and no schema command was run. resetDatabase will not delete rows unless a future explicit wipe is added.',
  );
} catch (error) {
  finish(error);
}
