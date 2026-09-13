import { readFileSync } from 'fs';
import { join } from 'path';
import { getAppVersion } from './app-version';

describe('getAppVersion', () => {
  it('matches backend/package.json version', () => {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
    ) as { version: string };
    expect(getAppVersion()).toBe(pkg.version);
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
