/**
 * Local-only: print env key names and non-secret host/port identity. Never prints secrets.
 */
const fs = require('fs');

function strip(val) {
  const v = String(val).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function reportEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`MISSING ${filePath}`);
    return;
  }
  const keys = [];
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    const val = strip(line.slice(idx + 1));
    keys.push(key);
    if (/URL$/i.test(key) || key === 'FRONTEND_URL' || key === 'CORS_ORIGIN' || key === 'ALLOWED_ORIGINS') {
      try {
        const first = val.split(',')[0].trim();
        const u = new URL(first);
        const loopback = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
        console.log(
          `${key} host=${u.hostname} port=${u.port || '(default)'} protocol=${u.protocol.replace(':', '')} loopback=${loopback}`,
        );
      } catch {
        console.log(`${key} present=true parse=non-url-or-list`);
      }
    } else if (['HOST', 'PORT', 'REDIS_HOST', 'REDIS_PORT', 'NODE_ENV'].includes(key)) {
      console.log(`${key}=${val}`);
    } else {
      console.log(`KEY ${key} present=true`);
    }
  }
  console.log(`FILE ${filePath} key_count=${keys.length}`);
}

function reportJsonKeys(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`MISSING ${filePath}`);
    return;
  }
  const obj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const keys = Object.keys(obj);
  console.log(`FILE ${filePath} keys=${keys.join(',')}`);
  for (const key of keys) {
    const val = obj[key];
    console.log(`KEY ${key} present=${val != null && String(val).length > 0} length=${val == null ? 0 : String(val).length}`);
  }
}

reportEnvFile('C:/scooch/Versions/v.2.0.4/backend/.env');
reportEnvFile('C:/scooch/Versions/v.2.0.4/frontend/.env.local');
reportJsonKeys('C:/scooch/Versions/v.2.0.4/frontend/cypress.env.json');
