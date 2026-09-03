/**
 * CLI: validate Doocard native backup JSON, optionally restore via BackupService.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/cli-restore-backup.ts --validate --file <path>
 *   npx ts-node -r tsconfig-paths/register scripts/cli-restore-backup.ts --restore --file <path>
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { BackupModule } from '../src/backup/backup.module';
import { BackupService } from '../src/backup/backup.service';
import { validateBackupPayloadForRestore } from '../src/backup/backup-restore.lib';
import { validateEnvironment } from '../src/config/env.validation';
import { PrismaModule } from '../src/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    BackupModule,
  ],
})
class RestoreCliModule {}

function parseArgs(argv: string[]) {
  const out: { validate: boolean; restore: boolean; file?: string } = {
    validate: false,
    restore: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--validate') out.validate = true;
    else if (a === '--restore') out.restore = true;
    else if (a === '--file') out.file = argv[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    throw new Error('Missing --file <path>');
  }
  if (!args.validate && !args.restore) {
    throw new Error('Specify --validate and/or --restore');
  }

  const filePath = path.resolve(args.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  validateBackupPayloadForRestore(parsed);
  const counts: Record<string, number> = {};
  for (const [k, v] of Object.entries(parsed.data || {})) {
    counts[k] = Array.isArray(v) ? v.length : -1;
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        stage: 'validated',
        metadata: parsed.metadata,
        modelKeys: Object.keys(parsed.data || {}),
        counts,
      },
      null,
      2,
    ),
  );

  if (!args.restore) {
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing restore while NODE_ENV=production');
  }

  const app = await NestFactory.createApplicationContext(RestoreCliModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const backup = app.get(BackupService);
    const result = await backup.restoreFromFile(filePath);
    console.log(JSON.stringify({ ok: true, stage: 'restored', result }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error('CLI_RESTORE_FAILED', e?.message || e);
  process.exit(1);
});
