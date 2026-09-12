const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TARGET_DB = 'doocard_release_206_validation';
const envText = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const match = envText.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
if (!match) process.exit(1);
let raw = match.slice('DATABASE_URL='.length).trim();
if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) raw = raw.slice(1, -1);
const u = new URL(raw);
if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
  console.error('REFUSED: not loopback');
  process.exit(2);
}
u.pathname = `/${TARGET_DB}`;
const args = process.argv.slice(2);
if (!args.length) {
  console.error('missing prisma args');
  process.exit(1);
}
const result = spawnSync('npx', ['prisma', ...args], {
  cwd: ROOT,
  env: { ...process.env, DATABASE_URL: u.toString() },
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status || 0);
