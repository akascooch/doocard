/**
 * LOCAL-ONLY Task 3 smoke test (OTP, staff filter, booking guard, remember-me).
 * Refuses non-localhost DATABASE_URL. Does not call sms.ir (adapter stub).
 *
 * Run after `npm run build`:
 *   node -r reflect-metadata -r tsconfig-paths/register -r ts-node/register scripts/test-task3-otp-booking.ts
 */
import 'reflect-metadata';
import { createHash } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../dist/app.module';
import { SmsIrVerifyAdapter } from '../dist/sms/adapters/smsir-verify.adapter';

loadEnv();

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const LISTEN_HOST = '127.0.0.1';
const LISTEN_PORT = 13993;
const OTP_PHONE = '09128881100';
const EMPLOYEE_PHONE = '09128881101';
const SERVICE_PHONE = '09128881102';
const EMPLOYEE_PASSWORD = 'SmokeTask3!Aa1';
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

const smokeOtp: { code: string; mobile: string } = { code: '', mobile: '' };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function dbTarget() {
  const raw = process.env.DATABASE_URL;
  assert(raw, 'DATABASE_URL is missing');
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: url.port || '5432',
    db: decodeURIComponent(url.pathname.replace(/^\//, '')),
  };
}

function assertLocalDb() {
  const t = dbTarget();
  assert(LOCAL_HOSTS.has(t.host), `Refusing non-local DATABASE_URL host: ${t.host}`);
  console.log(`[gate] local db host=${t.host} port=${t.port} db=${t.db}`);
}

function hashOtp(phone: string, code: string): string {
  const pepper =
    (process.env.SMS_OTP_PEPPER || '').trim() || process.env.JWT_SECRET || 'otp-pepper';
  return createHash('sha256').update(`${pepper}:${phone}:${code}`).digest('hex');
}

function stubSmsIrAdapter() {
  SmsIrVerifyAdapter.prototype.isConfigured = function isConfigured() {
    return true;
  };
  SmsIrVerifyAdapter.prototype.sendVerifyCode = async function sendVerifyCode(
    mobile: string,
    code: string,
  ) {
    smokeOtp.mobile = mobile;
    smokeOtp.code = code;
    return { success: true, messageId: 'local-smoke' };
  };
}

async function main() {
  assertLocalDb();
  process.env.SMS_ENABLED = 'false';
  process.env.HOST = LISTEN_HOST;
  stubSmsIrAdapter();

  const prisma = new PrismaClient();
  let app: Awaited<ReturnType<typeof NestFactory.create>> | null = null;
  let createdEmployeeUserId: number | null = null;
  let createdServiceUserId: number | null = null;
  let otpUserId: number | null = null;

  const fail = (label: string, err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[fail] ${label}: ${msg}`);
    throw err instanceof Error ? err : new Error(msg);
  };

  try {
    const tables = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT c.relname AS name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = 'otp_challenges'
    `;
    assert(tables.length === 1, 'otp_challenges table missing after migrate');
    console.log('[migrate] otp_challenges present');

    app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.listen(LISTEN_PORT, LISTEN_HOST);
    const base = `http://${LISTEN_HOST}:${LISTEN_PORT}/api`;
    console.log(`[http] listening ${base}`);

    await prisma.otpChallenge.deleteMany({ where: { phone: OTP_PHONE } });

    const req1 = await fetch(`${base}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: OTP_PHONE, purpose: 'LOGIN' }),
    });
    const req1Body = await req1.json().catch(() => ({}));
    assert(req1.status === 201 || req1.status === 200, `otp/request #1 expected 200/201 got ${req1.status} ${JSON.stringify(req1Body)}`);
    assert(req1Body?.ok === true, 'otp/request missing ok');
    assert(smokeOtp.code && /^\d{5}$/.test(smokeOtp.code), 'stub did not capture 5-digit OTP');

    const challenge = await prisma.otpChallenge.findFirst({
      where: { phone: OTP_PHONE },
      orderBy: { createdAt: 'desc' },
    });
    assert(challenge, 'otp_challenges row missing after request');
    assert(/^[a-f0-9]{64}$/.test(challenge.codeHash), `codeHash not sha256 hex: ${challenge.codeHash.slice(0, 12)}`);
    assert(challenge.codeHash !== smokeOtp.code, 'OTP stored in plaintext');
    assert(challenge.codeHash === hashOtp(OTP_PHONE, smokeOtp.code), 'codeHash does not match expected pepper hash');
    console.log(`[otp-request] status=${req1.status} hashLen=64 plaintext=false`);

    const req2 = await fetch(`${base}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: OTP_PHONE, purpose: 'LOGIN' }),
    });
    assert(req2.status === 201 || req2.status === 200, `otp/request #2 got ${req2.status}`);
    const req3 = await fetch(`${base}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: OTP_PHONE, purpose: 'LOGIN' }),
    });
    assert(req3.status === 201 || req3.status === 200, `otp/request #3 got ${req3.status}`);
    const lastCode = smokeOtp.code;

    const req4 = await fetch(`${base}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: OTP_PHONE, purpose: 'LOGIN' }),
    });
    const req4Body = await req4.json().catch(() => ({}));
    assert(req4.status === 429, `otp/request #4 expected 429 got ${req4.status} ${JSON.stringify(req4Body)}`);
    console.log(`[otp-throttle] #4 status=${req4.status}`);

    const verifyRes = await fetch(`${base}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: OTP_PHONE,
        code: lastCode,
        purpose: 'LOGIN',
        name: 'Smoke OTP Customer',
      }),
    });
    const verifyBody = await verifyRes.json().catch(() => ({}));
    assert(verifyRes.status === 201 || verifyRes.status === 200, `otp/verify expected 200/201 got ${verifyRes.status} ${JSON.stringify(verifyBody)}`);
    assert(verifyBody?.access_token, 'verify missing access_token');
    assert(verifyBody?.user?.id, 'verify missing user');
    assert(verifyBody?.user?.phone === OTP_PHONE, 'verify phone mismatch');
    const setCookie = (verifyRes.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.()
      || [verifyRes.headers.get('set-cookie') || ''];
    const cookieJoined = setCookie.filter(Boolean).join(';');
    assert(cookieJoined.includes('token='), 'access cookie not set');
    assert(cookieJoined.includes('refresh_token='), 'refresh cookie not set');
    otpUserId = Number(verifyBody.user.id);
    console.log(`[otp-verify] status=${verifyRes.status} userId=${otpUserId} cookies=token+refresh_token`);

    const passwordHash = await bcrypt.hash(EMPLOYEE_PASSWORD, 12);
    const empUser = await prisma.user.create({
      data: {
        name: 'SMOKE TASK3 EMPLOYEE',
        phone: EMPLOYEE_PHONE,
        password: passwordHash,
        role: 'EMPLOYEE',
      },
    });
    createdEmployeeUserId = empUser.id;
    await prisma.employee.create({
      data: { userId: empUser.id, isActive: true, specialty: 'smoke' },
    });

    const loginRes = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: EMPLOYEE_PHONE,
        password: EMPLOYEE_PASSWORD,
        rememberMe: true,
      }),
    });
    const loginBody = await loginRes.json().catch(() => ({}));
    assert(loginRes.status === 201 || loginRes.status === 200, `login expected 200/201 got ${loginRes.status} ${JSON.stringify(loginBody)}`);
    const refresh = await prisma.refreshToken.findFirst({
      where: { userId: empUser.id, isRevoked: false },
      orderBy: { createdAt: 'desc' },
    });
    assert(refresh, 'rememberMe refresh token missing');
    const ttlMs = refresh.expiresAt.getTime() - Date.now();
    const days = ttlMs / (24 * 60 * 60 * 1000);
    assert(days > 88 && days < 92, `rememberMe TTL expected ~90d got ${days.toFixed(2)}d`);
    console.log(`[remember-me] status=${loginRes.status} refreshDays=${days.toFixed(2)}`);

    const publicRes = await fetch(`${base}/employees/public/active`);
    const publicBody = await publicRes.json().catch(() => []);
    assert(publicRes.status === 200, `public/active expected 200 got ${publicRes.status}`);
    assert(Array.isArray(publicBody), 'public/active is not an array');
    const publicIds = publicBody.map((e: { id: number }) => e.id);
    if (publicIds.length > 0) {
      const rows = await prisma.employee.findMany({
        where: { id: { in: publicIds } },
        include: { user: { select: { role: true } } },
      });
      const bad = rows.filter((r) => r.user?.role !== 'EMPLOYEE');
      assert(bad.length === 0, `public/active included non-EMPLOYEE: ${bad.map((b) => `${b.id}:${b.user?.role}`).join(',')}`);
      for (let i = 1; i < publicBody.length; i += 1) {
        const prev = Number(publicBody[i - 1].appointmentCount ?? 0);
        const cur = Number(publicBody[i].appointmentCount ?? 0);
        assert(prev >= cur, `public/active not sorted by count at index ${i}: ${prev} then ${cur}`);
      }
    }
    console.log(`[employees-public] status=${publicRes.status} count=${publicBody.length} roles=EMPLOYEE-only sorted=true`);

    const svcUser = await prisma.user.create({
      data: {
        name: 'SMOKE TASK3 SERVICE',
        phone: SERVICE_PHONE,
        password: passwordHash,
        role: 'SERVICE',
      },
    });
    createdServiceUserId = svcUser.id;
    const svcEmp = await prisma.employee.create({
      data: { userId: svcUser.id, isActive: true, specialty: 'support-smoke' },
    });
    const customer = await prisma.customer.findFirst({ orderBy: { id: 'asc' } });
    const service = await prisma.service.findFirst({ orderBy: { id: 'asc' } });
    assert(customer, 'no customer in local DB for booking guard');
    assert(service, 'no service in local DB for booking guard');

    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, phone: true, role: true },
    });
    assert(admin, 'no ADMIN user for booking guard JWT');
    const jwt = app.get(JwtService);
    const adminToken = jwt.sign({
      sub: admin.id,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
    });

    const bookRes = await fetch(`${base}/appointments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId: customer.id,
        employeeId: svcEmp.id,
        scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        services: [{ serviceId: service.id, durationMin: 30 }],
      }),
    });
    const bookBody = await bookRes.json().catch(() => ({}));
    assert(bookRes.status === 400, `SERVICE booking expected 400 got ${bookRes.status} ${JSON.stringify(bookBody)}`);
    const msg = JSON.stringify(bookBody);
    assert(msg.includes('آرایشگر') || msg.includes('در دسترس'), `unexpected 400 payload: ${msg}`);
    console.log(`[booking-guard] status=${bookRes.status} rejected SERVICE employeeId=${svcEmp.id}`);

    console.log('[ok] task-3 local smoke passed');
  } catch (err) {
    fail('smoke', err);
  } finally {
    await prisma.otpChallenge.deleteMany({
      where: { phone: { in: [OTP_PHONE, EMPLOYEE_PHONE, SERVICE_PHONE] } },
    }).catch(() => undefined);

    const userIds = [createdEmployeeUserId, createdServiceUserId, otpUserId].filter(
      (id): id is number => typeof id === 'number',
    );
    if (userIds.length) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
      await prisma.customer.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
      await prisma.employee.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
      await prisma.user.deleteMany({
        where: {
          id: { in: userIds },
          phone: { in: [OTP_PHONE, EMPLOYEE_PHONE, SERVICE_PHONE] },
        },
      }).catch(() => undefined);
    }

    if (app) {
      await app.close().catch(() => undefined);
    }
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    setTimeout(() => process.exit(1), 250);
  });
