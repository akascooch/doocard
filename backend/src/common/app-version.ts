import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Canonical backend version from package.json (doocard-backend).
 * PM2 cwd is /var/www/doocard/backend so process.cwd()/package.json is first.
 * Does not invent a version if the file cannot be read.
 */
let cached: string | undefined;

export function getAppVersion(): string {
  if (cached) {
    return cached;
  }

  const npmVersion = process.env.npm_package_version?.trim();
  const candidates = [
    join(process.cwd(), 'package.json'),
    join(__dirname, '..', '..', 'package.json'),
    join(__dirname, '..', 'package.json'),
  ];

  for (const file of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(file, 'utf8')) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === 'doocard-backend' && typeof pkg.version === 'string' && pkg.version) {
        cached = pkg.version;
        return cached;
      }
    } catch {
      // try next candidate
    }
  }

  if (npmVersion) {
    cached = npmVersion;
    return cached;
  }

  cached = 'unknown';
  return cached;
}
