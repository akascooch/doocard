/**
 * Local-only helper: inspect DATABASE_URL (no secrets) and clone Doocard
 * into disposable doocard_release_206_validation.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const PSQL = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';
const TARGET_DB = 'doocard_release_206_validation';

function parseEnvFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const map = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }
  return map;
}

function reportUrl(label, raw) {
  const u = new URL(raw);
  const db = u.pathname.replace(/^\//, '').split('?')[0];
  const ssl = u.searchParams.get('sslmode') || 'not-set';
  const loopback = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  console.log(
    `${label} host=${u.hostname} port=${u.port || '5432'} db=${db} sslmode=${ssl} loopback=${loopback}`,
  );
  return { u, db, loopback };
}

if (!fs.existsSync(ENV_PATH)) {
  console.error('backend/.env missing');
  process.exit(1);
}
if (!fs.existsSync(PSQL)) {
  console.error('psql.exe not found');
  process.exit(1);
}

const env = parseEnvFile(ENV_PATH);
if (!env.DATABASE_URL) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const src = reportUrl('SOURCE', env.DATABASE_URL);
if (!src.loopback) {
  console.error('REFUSED: DATABASE_URL host is not loopback');
  process.exit(2);
}
if (src.db === 'doocard') {
  console.error('REFUSED: lowercase doocard looks like production name');
  process.exit(2);
}

const action = process.argv[2] || 'inspect';
const adminUrl = new URL(env.DATABASE_URL);
adminUrl.pathname = '/postgres';
const password = decodeURIComponent(adminUrl.password);
const user = decodeURIComponent(adminUrl.username);
const host = adminUrl.hostname;
const port = adminUrl.port || '5432';

function psql(args, database) {
  const result = spawnSync(PSQL, ['-h', host, '-p', String(port), '-U', user, '-d', database, '-v', 'ON_ERROR_STOP=1', ...args], {
    env: { ...process.env, PGPASSWORD: password, PGSSLMODE: 'disable' },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || 'psql failed');
    process.exit(result.status || 1);
  }
  return result.stdout;
}

if (action === 'inspect') {
  process.exit(0);
}

if (action === 'verify') {
  const table = psql(
    ['-tAc', "SELECT to_regclass('public.product_stock_subscriptions');"],
    TARGET_DB,
  ).trim();
  const channel = psql(
    ['-tAc', "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StockWaitlistChannel');"],
    TARGET_DB,
  ).trim();
  const status = psql(
    ['-tAc', "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StockWaitlistStatus');"],
    TARGET_DB,
  ).trim();
  const quote = psql(
    [
      '-tAc',
      "SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'OrderStatus' AND e.enumlabel = 'AWAITING_QUOTE');",
    ],
    TARGET_DB,
  ).trim();
  console.log(`table_product_stock_subscriptions=${table}`);
  console.log(`type_StockWaitlistChannel=${channel}`);
  console.log(`type_StockWaitlistStatus=${status}`);
  console.log(`enum_AWAITING_QUOTE=${quote}`);
  if (table !== 'product_stock_subscriptions' || channel !== 't' || status !== 't' || quote !== 't') {
    process.exit(3);
  }
  process.exit(0);
}

if (action === 'create') {
  const existing = psql(['-tAc', `SELECT 1 FROM pg_database WHERE datname='${TARGET_DB}'`], 'postgres').trim();
  if (existing === '1') {
    console.log(`TARGET exists=${TARGET_DB}`);
    process.exit(0);
  }
  console.log(`Creating ${TARGET_DB} TEMPLATE ${src.db}`);
  psql(['-c', `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${src.db.replace(/'/g, "''")}' AND pid <> pg_backend_pid();`], 'postgres');
  psql(['-c', `CREATE DATABASE ${TARGET_DB} WITH TEMPLATE "${src.db}" OWNER ${user};`], 'postgres');
  console.log(`CREATED ${TARGET_DB}`);
  process.exit(0);
}

console.error('usage: inspect | create');
process.exit(1);
