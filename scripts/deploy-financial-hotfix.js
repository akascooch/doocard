/**
 * One-off deploy script: sync dashboard.service.ts and run build + pm2 on production.
 * Usage: node scripts/deploy-financial-hotfix.js
 * Requires: npm install ssh2 (run from project root: npm install ssh2 --no-save)
 */
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const SSH_CONFIG = {
  host: process.env.DEPLOY_HOST || '185.255.88.158',
  port: parseInt(process.env.DEPLOY_PORT || '3031', 10),
  username: process.env.DEPLOY_USER || 'root',
  password: process.env.DEPLOY_PASSWORD || '',
};

const LOCAL_FILE = path.join(__dirname, '..', 'backend', 'src', 'dashboard', 'dashboard.service.ts');
const REMOTE_PATH = '/var/www/doocard/backend/src/dashboard/dashboard.service.ts';

function run(conn, cmd, label) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      stream.on('data', (d) => { out += d.toString(); });
      stream.stderr.on('data', (d) => { errOut += d.toString(); });
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(`${label} exited ${code}\n${out}\n${errOut}`));
        else resolve(out);
      });
    });
  });
}

function main() {
  const conn = new Client();
  const content = fs.readFileSync(LOCAL_FILE, 'utf8');

  conn.on('ready', () => {
    Promise.resolve()
      .then(() => run(conn, `mkdir -p /var/www/doocard/backend/src/dashboard`, 'mkdir'))
      .then(() => {
        return new Promise((resolve, reject) => {
          conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const buf = Buffer.from(content, 'utf8');
            sftp.writeFile(REMOTE_PATH, buf, (e) => (e ? reject(e) : resolve()));
          });
        });
      })
      .then(() => run(conn, 'cd /var/www/doocard/backend && npm run build', 'backend build'))
      .then((out) => { console.log('BACKEND BUILD:\n', out); })
      .then(() => run(conn, 'pm2 reload doocard-backend --update-env', 'pm2 reload backend'))
      .then((out) => { console.log('PM2 RELOAD BACKEND:\n', out); })
      .then(() => run(conn, 'cd /var/www/doocard/frontend && npm run build', 'frontend build'))
      .then((out) => { console.log('FRONTEND BUILD:\n', out); })
      .then(() => run(conn, 'pm2 restart doocard-frontend', 'pm2 restart frontend'))
      .then((out) => { console.log('PM2 RESTART FRONTEND:\n', out); })
      .then(() => run(conn, 'pm2 list', 'pm2 list'))
      .then((out) => { console.log('PM2 LIST:\n', out); })
      .then(() => run(conn, 'pm2 logs doocard-backend --lines 50 --nostream', 'pm2 logs'))
      .then((out) => { console.log('PM2 LOGS (last 50):\n', out); })
      .then(() => { conn.end(); process.exit(0); })
      .catch((err) => { console.error(err); conn.end(); process.exit(1); });
  }).on('error', (err) => {
    console.error('SSH error:', err.message);
    process.exit(1);
  });

  conn.connect(SSH_CONFIG);
}

main();
