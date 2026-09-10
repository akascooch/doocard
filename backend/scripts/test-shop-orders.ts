/**
 * LOCAL-ONLY shop-orders smoke test.
 * Refuses to run unless DATABASE_URL host is localhost/127.0.0.1.
 * Boots compiled Nest on 127.0.0.1:13991 with SMS_ENABLED=false (no outbound SMS).
 *
 * Run after `npm run build`:
 *   node -r reflect-metadata -r tsconfig-paths/register -r ts-node/register scripts/test-shop-orders.ts
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../dist/app.module';

loadEnv();

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const LISTEN_HOST = '127.0.0.1';
const LISTEN_PORT = 13992;
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

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

async function main() {
  assertLocalDb();
  process.env.SMS_ENABLED = 'false';
  process.env.HOST = LISTEN_HOST;

  const prisma = new PrismaClient();
  let createdProductId: number | null = null;
  let createdCategoryId: number | null = null;
  let orderId: string | null = null;
  let receiptRel: string | null = null;
  let app: Awaited<ReturnType<typeof NestFactory.create>> | null = null;

  const fail = (label: string, err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[fail] ${label}: ${msg}`);
    throw err instanceof Error ? err : new Error(msg);
  };

  try {
    let product = await prisma.product.findFirst({
      where: { isActive: true, stock: { gt: 0 }, priceRial: { gt: 0 } },
      orderBy: { id: 'asc' },
    });

    if (!product) {
      const category = await prisma.productCategory.create({
        data: { name: `SMOKE-SHOP-${Date.now()}`, isActive: true },
      });
      createdCategoryId = category.id;
      product = await prisma.product.create({
        data: {
          name: 'SMOKE TEST PRODUCT',
          sku: `SMOKE-${Date.now()}`,
          priceRial: BigInt(100000),
          stock: 3,
          isActive: true,
          isPriceVisible: true,
          categoryId: category.id,
        },
      });
      createdProductId = product.id;
      console.log(`[catalog] created smoke product id=${product.id} stock=${product.stock}`);
    } else {
      console.log(`[catalog] using product id=${product.id} stock=${product.stock}`);
    }

    const stockBefore = product.stock;

    app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn'],
    });
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

    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, phone: true, role: true },
    });
    assert(admin, 'No ADMIN user in local DB — cannot call admin endpoints');
    const jwt = app.get(JwtService);
    const token = jwt.sign({
      sub: admin.id,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
    });

    const form = new FormData();
    form.append('customerName', 'Smoke Test Customer');
    form.append('customerPhone', '09120000000');
    form.append('customerAddress', 'Local smoke test');
    form.append('customerNotes', 'shop-orders smoke');
    form.append('items', JSON.stringify([{ productId: product.id, quantity: 1 }]));
    form.append('receipt', new Blob([new Uint8Array(PNG_1X1)], { type: 'image/png' }), 'receipt.png');

    const createRes = await fetch(`${base}/orders`, { method: 'POST', body: form });
    const createBody = await createRes.json().catch(() => ({}));
    assert(
      createRes.status === 201 || createRes.status === 200,
      `POST /orders expected 201/200 got ${createRes.status} ${JSON.stringify(createBody)}`,
    );
    assert(createBody?.id, 'create response missing id');
    assert(createBody?.orderNumber, 'create response missing orderNumber');
    orderId = String(createBody.id);
    receiptRel = createBody.receiptImageUrl || null;
    console.log(`[create] status=${createRes.status} id=${orderId} orderNumber=${createBody.orderNumber}`);

    const afterCreate = await prisma.product.findUnique({ where: { id: product.id } });
    assert(afterCreate, 'product missing after create');
    assert(
      afterCreate.stock === stockBefore - 1,
      `stock after create expected ${stockBefore - 1} got ${afterCreate.stock}`,
    );
    console.log(`[stock] after create ${stockBefore} -> ${afterCreate.stock}`);

    const getRes = await fetch(`${base}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const got = await getRes.json();
    assert(getRes.status === 200, `GET /orders/:id expected 200 got ${getRes.status}`);
    assert(got.id === orderId, 'GET id mismatch');
    assert(got.customerName === 'Smoke Test Customer', 'customerName mismatch');
    assert(got.customerPhone === '09120000000', 'customerPhone mismatch');
    assert(typeof got.totalAmountRial === 'string', 'totalAmountRial must be string');
    assert(Array.isArray(got.items) && got.items.length === 1, 'items missing');
    assert(typeof got.items[0].unitPriceRial === 'string', 'unitPriceRial must be string');
    assert(typeof got.receiptImageUrl === 'string' && got.receiptImageUrl.startsWith('/uploads/receipts/'), 'receipt URL missing');
    console.log(`[admin-get] ok receipt=${got.receiptImageUrl} total=${got.totalAmountRial}`);

    const paidRes = await fetch(`${base}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'PAID', adminNotes: 'smoke paid' }),
    });
    const paid = await paidRes.json();
    assert(paidRes.status === 200, `PATCH PAID expected 200 got ${paidRes.status} ${JSON.stringify(paid)}`);
    assert(paid.status === 'PAID', `expected PAID got ${paid.status}`);
    assert(paid.verifiedAt, 'verifiedAt not set after PAID');
    console.log(`[status] PAID verifiedAt=${paid.verifiedAt}`);

    const cancelRes = await fetch(`${base}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'CANCELLED', adminNotes: 'smoke cleanup' }),
    });
    const cancelled = await cancelRes.json();
    assert(cancelRes.status === 200, `PATCH CANCELLED expected 200 got ${cancelRes.status}`);
    assert(cancelled.status === 'CANCELLED', `expected CANCELLED got ${cancelled.status}`);

    const afterCancel = await prisma.product.findUnique({ where: { id: product.id } });
    assert(afterCancel, 'product missing after cancel');
    assert(
      afterCancel.stock === stockBefore,
      `stock after cancel expected ${stockBefore} got ${afterCancel.stock}`,
    );
    console.log(`[stock] after cancel restored ${afterCancel.stock}`);

    await prisma.order.delete({ where: { id: orderId } }).catch(() => undefined);
    orderId = null;
    if (receiptRel) {
      const fileName = receiptRel.split('/').pop();
      if (fileName) {
        const filePath = join(process.cwd(), 'uploads', 'receipts', fileName);
        if (existsSync(filePath)) unlinkSync(filePath);
      }
    }

    if (createdProductId) {
      await prisma.product.delete({ where: { id: createdProductId } }).catch(() => undefined);
    }
    if (createdCategoryId) {
      await prisma.productCategory.delete({ where: { id: createdCategoryId } }).catch(() => undefined);
    }

    console.log('[ok] shop-orders smoke test passed (local only)');
  } catch (err) {
    fail('smoke', err);
  } finally {
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
