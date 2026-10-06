/**
 * Integration-test gate. Does not connect, migrate, seed, or reset a database.
 * Unit tests do not call this file.
 */
import { existsSync } from 'fs';
import { resolve } from 'path';

function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  refuse(
    'Integration setup refused: set TEST_DATABASE_URL to an isolated local database whose name contains "test". This command does not read DATABASE_URL and does not create a database. Unit tests: npm run test:unit.',
  );
}

if (process.env.DATABASE_URL && testUrl === process.env.DATABASE_URL) {
  refuse('Integration setup refused: TEST_DATABASE_URL must not equal DATABASE_URL.');
}

let parsed: URL;
try {
  parsed = new URL(testUrl);
} catch {
  refuse('Integration setup refused: TEST_DATABASE_URL is not a valid URL.');
}

const host = parsed.hostname;
const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
if (host !== '127.0.0.1' && host !== 'localhost') {
  refuse('Integration setup refused: the database host must be 127.0.0.1 or localhost.');
}
if (!/test/i.test(databaseName)) {
  refuse('Integration setup refused: the database name must contain "test".');
}

const harness = resolve(__dirname, '../tests/prisma-test.service.ts');
if (!existsSync(harness)) {
  refuse(
    'Integration execution blocked: backend/tests/prisma-test.service.ts is not in this repository. No connection was opened and no schema command was run.',
  );
}

console.log('Isolated TEST_DATABASE_URL accepted. No database connection was opened.');
