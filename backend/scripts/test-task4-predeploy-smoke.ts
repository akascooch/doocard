/**
 * LOCAL-ONLY Task 3+4 contract smoke (dashboard, IDOR, admin history, OTP table).
 * Refuses non-localhost DATABASE_URL. Does not call sms.ir. Does not touch production.
 *
 * Run after backend `npm run build`:
 *   node -r reflect-metadata -r tsconfig-paths/register -r ts-node/register scripts/test-task4-predeploy-smoke.ts
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../dist/app.module';

loadEnv();

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const LISTEN_HOST = '127.0.0.1';
const LISTEN_PORT = 13994;
const PREFIX = '09127771';
const PHONES = {
  employee: `${PREFIX}001`,
  service: `${PREFIX}002`,
  customerA: `${PREFIX}003`,
  customerB: `${PREFIX}004`,
};
const PASSWORD = 'SmokeTask4!Aa1';

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

async function jsonFetch(url: string, init: RequestInit = {}) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function main() {
  assertLocalDb();
  process.env.SMS_ENABLED = 'false';
  process.env.HOST = LISTEN_HOST;

  const prisma = new PrismaClient();
  let app: Awaited<ReturnType<typeof NestFactory.create>> | null = null;
  const createdUserIds: number[] = [];
  const createdAppointmentIds: number[] = [];

  const fail = (label: string, err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[fail] ${label}: ${msg}`);
    throw err instanceof Error ? err : new Error(msg);
  };

  const cleanup = async () => {
    if (createdAppointmentIds.length) {
      await prisma.appointment
        .deleteMany({ where: { id: { in: createdAppointmentIds } } })
        .catch(() => undefined);
    }
    const phones = Object.values(PHONES);
    const leftover = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const userIds = [...new Set([...createdUserIds, ...leftover.map((u) => u.id)])];
    if (userIds.length) {
      await prisma.appointment
        .deleteMany({ where: { customer: { userId: { in: userIds } } } })
        .catch(() => undefined);
      await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
      await prisma.customer.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
      await prisma.employee.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: userIds }, phone: { in: phones } } }).catch(() => undefined);
    }
    await prisma.otpChallenge.deleteMany({ where: { phone: { in: phones } } }).catch(() => undefined);
  };

  try {
    const tables = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT c.relname AS name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = 'otp_challenges'
    `;
    assert(tables.length === 1, 'otp_challenges table missing — Task 3 migrate not applied locally');
    const otpCount = await prisma.otpChallenge.count();
    assert(typeof otpCount === 'number', 'Prisma OtpChallenge client broken');
    console.log(`[otp-compat] otp_challenges present count=${otpCount}`);

    await cleanup();

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

    const jwt = app.get(JwtService);
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const serviceRow = await prisma.service.findFirst({ orderBy: { id: 'asc' } });
    assert(serviceRow, 'no service in local DB');

    const empUser = await prisma.user.create({
      data: {
        name: 'SMOKE T4 EMPLOYEE',
        phone: PHONES.employee,
        password: passwordHash,
        role: 'EMPLOYEE',
      },
    });
    createdUserIds.push(empUser.id);
    await prisma.employee.create({
      data: { userId: empUser.id, isActive: true, specialty: 'smoke-t4' },
    });

    const svcUser = await prisma.user.create({
      data: {
        name: 'SMOKE T4 SERVICE',
        phone: PHONES.service,
        password: passwordHash,
        role: 'SERVICE',
      },
    });
    createdUserIds.push(svcUser.id);
    await prisma.employee.create({
      data: { userId: svcUser.id, isActive: true, specialty: 'smoke-t4-svc' },
    });

    const custAUser = await prisma.user.create({
      data: {
        name: 'SMOKE T4 CUSTOMER A',
        phone: PHONES.customerA,
        password: passwordHash,
        role: 'CUSTOMER',
      },
    });
    createdUserIds.push(custAUser.id);
    const custA = await prisma.customer.create({ data: { userId: custAUser.id } });

    const custBUser = await prisma.user.create({
      data: {
        name: 'SMOKE T4 CUSTOMER B',
        phone: PHONES.customerB,
        password: passwordHash,
        role: 'CUSTOMER',
      },
    });
    createdUserIds.push(custBUser.id);
    const custB = await prisma.customer.create({ data: { userId: custBUser.id } });

    const emp = await prisma.employee.findUnique({ where: { userId: empUser.id } });
    assert(emp, 'employee row missing');

    const apptB = await prisma.appointment.create({
      data: {
        customerId: custB.id,
        employeeId: emp.id,
        status: 'CONFIRMED',
        durationMin: 30,
        scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        services: [
          {
            serviceId: serviceRow.id,
            durationMin: 30,
            priceAtBooking: 0,
            serviceName: serviceRow.name,
          },
        ],
        notes: 'SMOKE-T4-IDOR-B',
      },
    });
    createdAppointmentIds.push(apptB.id);

    const tokenFor = (user: { id: number; email?: string | null; phone: string; role: string }) =>
      jwt.sign({
        sub: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
      });

    const empToken = tokenFor(empUser);
    const svcToken = tokenFor(svcUser);
    const custAToken = tokenFor(custAUser);
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, phone: true, role: true },
    });
    assert(admin, 'no ADMIN user in local DB');
    const adminToken = tokenFor(admin);

    const statsEmp = await jsonFetch(`${base}/dashboard/employee-stats`, {
      headers: authHeader(empToken),
    });
    assert(statsEmp.res.status === 200, `employee-stats EMPLOYEE expected 200 got ${statsEmp.res.status} ${JSON.stringify(statsEmp.body)}`);
    assert(
      Object.prototype.hasOwnProperty.call(statsEmp.body, 'monthlyNetEarningsRial'),
      'employee-stats missing monthlyNetEarningsRial',
    );
    assert(typeof statsEmp.body.monthlyNetEarningsRial === 'string', 'monthlyNetEarningsRial must be string');
    assert(statsEmp.body.averageRating === null, `averageRating expected null got ${statsEmp.body.averageRating}`);
    assert(typeof statsEmp.body.todayAppointments === 'number', 'todayAppointments missing');
    console.log(
      `[employee-stats] EMPLOYEE 200 net=${statsEmp.body.monthlyNetEarningsRial} rating=${statsEmp.body.averageRating}`,
    );

    const statsSvc = await jsonFetch(`${base}/dashboard/employee-stats`, {
      headers: authHeader(svcToken),
    });
    assert(statsSvc.res.status === 200, `employee-stats SERVICE expected 200 got ${statsSvc.res.status}`);
    assert(statsSvc.body.averageRating === null, 'SERVICE averageRating expected null');
    console.log(`[employee-stats] SERVICE 200`);

    const perf = await jsonFetch(`${base}/dashboard/employee-performance?year=1405`, {
      headers: authHeader(empToken),
    });
    assert(perf.res.status === 200, `employee-performance expected 200 got ${perf.res.status} ${JSON.stringify(perf.body)}`);
    assert(Array.isArray(perf.body.years) && perf.body.years.length === 5, `years length expected 5 got ${perf.body.years?.length}`);
    assert(Array.isArray(perf.body.months) && perf.body.months.length === 12, `months length expected 12 got ${perf.body.months?.length}`);
    assert(perf.body.summary && typeof perf.body.summary.netEarningsRial === 'string', 'summary.netEarningsRial missing');
    assert(Array.isArray(perf.body.topServices), 'topServices missing');
    assert(perf.body.selectedJalaliYear === 1405, `selectedJalaliYear expected 1405 got ${perf.body.selectedJalaliYear}`);
    console.log(
      `[employee-performance] 200 years=${perf.body.years.length} months=${perf.body.months.length} selected=${perf.body.selectedJalaliYear}`,
    );

    const idor = await jsonFetch(`${base}/appointments?customerId=${custB.id}`, {
      headers: authHeader(custAToken),
    });
    assert(idor.res.status === 200, `IDOR probe expected 200 scoped list got ${idor.res.status} ${JSON.stringify(idor.body)}`);
    const idorRows = Array.isArray(idor.body?.data) ? idor.body.data : Array.isArray(idor.body) ? idor.body : [];
    const leaked = idorRows.filter((row: { id?: number; customerId?: number }) => row.id === apptB.id || row.customerId === custB.id);
    assert(leaked.length === 0, `IDOR leak: customer A saw B appointment ${JSON.stringify(leaked)}`);
    console.log(`[idor] CUSTOMER A query customerId=${custB.id} leaked=0 rows=${idorRows.length}`);

    const customers = await jsonFetch(`${base}/customers`, {
      headers: authHeader(adminToken),
    });
    assert(customers.res.status === 200, `GET /customers expected 200 got ${customers.res.status}`);
    assert(Array.isArray(customers.body), 'GET /customers expected array');
    const smokeCustomer = customers.body.find((c: { id: number }) => c.id === custB.id);
    assert(smokeCustomer, 'smoke customer B missing from admin list');
    assert(
      smokeCustomer._count && typeof smokeCustomer._count.appointments === 'number',
      `_count.appointments missing on customer ${JSON.stringify(smokeCustomer._count)}`,
    );
    assert(smokeCustomer._count.appointments >= 1, `_count.appointments expected >=1 got ${smokeCustomer._count.appointments}`);
    console.log(`[customers] ADMIN 200 _count.appointments=${smokeCustomer._count.appointments}`);

    const history = await jsonFetch(`${base}/appointments?customerId=${custB.id}&take=20`, {
      headers: authHeader(adminToken),
    });
    assert(history.res.status === 200, `admin appointments?customerId expected 200 got ${history.res.status}`);
    const historyRows = Array.isArray(history.body?.data)
      ? history.body.data
      : Array.isArray(history.body)
        ? history.body
        : [];
    assert(
      historyRows.some((row: { id?: number }) => row.id === apptB.id),
      `admin modal source missing appointment ${apptB.id}`,
    );
    console.log(`[appointments-admin] customerId=${custB.id} rows=${historyRows.length} includesSmokeAppt=true`);

    console.log('[ok] task-4 predeploy local smoke passed');
  } catch (err) {
    fail('smoke', err);
  } finally {
    await cleanup();
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
