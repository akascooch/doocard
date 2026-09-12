/**
 * Local-only: start Nest against doocard_release_206_validation on loopback.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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
console.log(`starting backend host=127.0.0.1 port=3001 db=${TARGET_DB}`);
const child = spawn('npm', ['run', 'start'], {
  cwd: ROOT,
  env: {
    ...process.env,
    DATABASE_URL: u.toString(),
    HOST: '127.0.0.1',
    PORT: '3001',
  },
  stdio: 'inherit',
  shell: true,
});
child.on('exit', (code) => process.exit(code || 0));
