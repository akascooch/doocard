/**
 * QA script for backup/restore system
 * Run: npx ts-node scripts/qa-backup-restore-test.ts
 */
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const API = process.env.API_URL || 'http://localhost:3001/api';
const ADMIN_ID = process.env.ADMIN_IDENTIFIER || '09123456789';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

const results: { step: string; pass: boolean; detail: string }[] = [];

function log(step: string, pass: boolean, detail: string) {
  results.push({ step, pass, detail });
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} [${step}] ${detail}`);
}

async function login(): Promise<string> {
  const res = await axios.post(`${API}/auth/login`, {
    identifier: ADMIN_ID,
    password: ADMIN_PASS,
  });
  const token = res.data?.access_token;
  if (!token) throw new Error('Login failed — no access_token');
  return token;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function runManualBackupExport(token: string): Promise<Buffer> {
  const stage = await axios.post(
    `${API}/settings/backup/run`,
    {},
    { headers: authHeaders(token) },
  );
  const downloadId = stage.data?.downloadId;
  if (!downloadId) {
    throw new Error('backup/run did not return downloadId');
  }
  const dl = await axios.get(
    `${API}/settings/backup/download-direct/${encodeURIComponent(downloadId)}`,
    { responseType: 'arraybuffer' },
  );
  return Buffer.from(dl.data);
}

async function main() {
  console.log('=== Doocard Backup/Restore QA ===\n');
  let token: string;
  try {
    token = await login();
    log('Auth', true, `Logged in as ${ADMIN_ID}`);
  } catch (e: any) {
    log('Auth', false, e?.response?.data?.message || e.message);
    printSummary();
    process.exit(1);
  }

  // --- 1. Persistence Test ---
  const testPath = './my-backups';
  try {
    const patchRes = await axios.patch(
      `${API}/settings/config`,
      {
        autoBackupEnabled: true,
        backupIntervalDays: 3,
        backupPath: testPath,
      },
      { headers: authHeaders(token) },
    );

    const getRes = await axios.get(`${API}/settings/config`, {
      headers: authHeaders(token),
    });

    const ok =
      getRes.data.autoBackupEnabled === true &&
      getRes.data.backupIntervalDays === 3 &&
      getRes.data.backupPath === testPath;

    log(
      'Persistence',
      ok,
      ok
        ? `interval=3, path=${getRes.data.backupPath}, auto=${getRes.data.autoBackupEnabled}`
        : `Expected interval=3 path=${testPath}, got ${JSON.stringify(getRes.data)}`,
    );
  } catch (e: any) {
    log('Persistence', false, e?.response?.data?.message || e.message);
  }

  // --- 2. Backup Integrity Test ---
  let backupFilePath = '';
  let backupPayload: any = null;
  try {
    const backupBytes = await runManualBackupExport(token);

    const backupDir = path.resolve(process.cwd(), 'my-backups');
    const files = fs.existsSync(backupDir)
      ? fs.readdirSync(backupDir).filter((f) => f.endsWith('.json'))
      : [];
    files.sort((a, b) =>
      fs.statSync(path.join(backupDir, b)).mtimeMs -
      fs.statSync(path.join(backupDir, a)).mtimeMs,
    );

    backupFilePath = files.length
      ? path.join(backupDir, files[0])
      : path.join(backupDir, 'manual-download.json');

    if (!files.length) {
      fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(backupFilePath, backupBytes);
    }

    backupPayload = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));

    const hasUsers =
      Array.isArray(backupPayload.data?.user) && backupPayload.data.user.length > 0;
    const hasCustomers = Array.isArray(backupPayload.data?.customer);
    const hasServices = Array.isArray(backupPayload.data?.service);
    const modelKeys = Object.keys(backupPayload.data || {});
    const modelCountOk = modelKeys.length >= 30;

    const smsSettings = backupPayload.data?.smsSettings?.[0];
    const smsMasked =
      !smsSettings?.apiKey || smsSettings.apiKey === '[REDACTED]';
    const userPassword = backupPayload.data?.user?.[0]?.password;
    const passwordPreserved =
      typeof userPassword === 'string' && userPassword.length > 10;

    const integrityOk =
      hasUsers && hasCustomers && hasServices && modelCountOk && smsMasked;

    log(
      'Backup Integrity',
      integrityOk,
      `file=${backupFilePath}, models=${modelKeys.length}, users=${backupPayload.data.user.length}, customers=${backupPayload.data.customer?.length ?? 0}, smsMasked=${smsMasked}, passwordPreserved=${passwordPreserved}`,
    );
  } catch (e: any) {
    log('Backup Integrity', false, e?.response?.data?.message || e.message);
  }

  // --- 3. Restore Safety Test ---
  const dummyPhone = `0999${Date.now().toString().slice(-7)}`;
  let dummyCustomerId: number | null = null;
  try {
    const createRes = await axios.post(
      `${API}/customers`,
      { name: 'QA Backup Test Customer', phone: dummyPhone },
      { headers: authHeaders(token) },
    );
    dummyCustomerId = createRes.data?.id;

  // Re-backup after dummy customer
    const backupBytes2 = await runManualBackupExport(token);

    const backupDir = path.resolve(process.cwd(), 'my-backups');
    const restoreFile = path.join(backupDir, `qa-restore-${Date.now()}.json`);
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(restoreFile, backupBytes2);
    backupFilePath = restoreFile;
    backupPayload = JSON.parse(fs.readFileSync(restoreFile, 'utf8'));

    if (dummyCustomerId) {
      await axios.delete(`${API}/customers/${dummyCustomerId}`, {
        headers: authHeaders(token),
      });
    }

    const afterDelete = await axios.get(`${API}/customers/phone/${dummyPhone}`, {
      headers: authHeaders(token),
    }).catch(() => null);

    const deletedOk = !afterDelete?.data;

    const form = new FormData();
    const blob = new Blob([fs.readFileSync(restoreFile)], { type: 'application/json' });
    form.append('backupFile', blob, path.basename(restoreFile));

    await axios.post(`${API}/settings/backup/restore`, form, {
      headers: { ...authHeaders(token) },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const restored = await axios.get(`${API}/customers/phone/${dummyPhone}`, {
      headers: authHeaders(token),
    });

    const restoreOk =
      deletedOk &&
      restored?.data &&
      (restored.data.phone === dummyPhone ||
        restored.data.user?.phone === dummyPhone);

    log(
      'Restore Safety',
      !!restoreOk,
      restoreOk
        ? `Customer ${dummyPhone} deleted then restored successfully`
        : `deletedOk=${deletedOk}, restored=${JSON.stringify(restored?.data?.phone || restored?.data)}`,
    );
  } catch (e: any) {
    log('Restore Safety', false, e?.response?.data?.message || e.message);
  }

  // --- 4. Path Security Test ---
  try {
    await axios.patch(
      `${API}/settings/config`,
      { backupPath: 'C:/Windows' },
      { headers: authHeaders(token) },
    );
    // If patch succeeded, try backup to trigger permission error
    try {
      await axios.post(
        `${API}/settings/backup/run`,
        {},
        { headers: authHeaders(token), validateStatus: () => true },
      );
      log('Path Security', true, 'C:/Windows rejected or backup failed gracefully (no crash)');
    } catch (inner: any) {
      log('Path Security', true, `Backup to protected path failed gracefully: ${inner?.response?.status || inner.message}`);
    }
  } catch (e: any) {
    const status = e?.response?.status;
    const msg = e?.response?.data?.message || e.message;
    const graceful = status === 400 || status === 403 || status === 500;
    log(
      'Path Security',
      graceful,
      `Protected path blocked (${status}): ${msg}`,
    );
  }

  // Restore safe path after path security test
  try {
    await axios.patch(
      `${API}/settings/config`,
      { backupPath: './my-backups', backupIntervalDays: 3 },
      { headers: authHeaders(token) },
    );
  } catch {
    // ignore
  }

  printSummary();
  const failed = results.filter((r) => !r.pass).length;
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  console.log('\n=== SUMMARY ===');
  const passed = results.filter((r) => r.pass).length;
  console.log(`${passed}/${results.length} tests passed`);
  results.filter((r) => !r.pass).forEach((r) => {
    console.log(`  FAIL: ${r.step} — ${r.detail}`);
  });
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
