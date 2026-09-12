import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const PHONE = process.env.E2E_CUSTOMER_IDENTIFIER || '09101112233';
const FRONTEND_ENV = path.resolve(__dirname, '../../frontend/cypress.env.json');

function loadOrCreatePassword(): string {
  if (process.env.E2E_CUSTOMER_PASSWORD) return process.env.E2E_CUSTOMER_PASSWORD;
  if (fs.existsSync(FRONTEND_ENV)) {
    const parsed = JSON.parse(fs.readFileSync(FRONTEND_ENV, 'utf8'));
    if (parsed.E2E_CUSTOMER_PASSWORD) return String(parsed.E2E_CUSTOMER_PASSWORD);
  }
  return crypto.randomBytes(12).toString('base64url') + 'Aa1!';
}

async function main() {
  const password = loadOrCreatePassword();
  const passwordHash = await bcrypt.hash(password, 10);

  const customerUser = await prisma.user.upsert({
    where: { phone: PHONE },
    update: { password: passwordHash, role: UserRole.CUSTOMER, name: 'E2E Customer' },
    create: {
      name: 'E2E Customer',
      phone: PHONE,
      email: 'e2e.customer@doocard.local.test',
      password: passwordHash,
      role: UserRole.CUSTOMER,
    },
  });
  await prisma.customer.upsert({
    where: { userId: customerUser.id },
    update: {},
    create: { userId: customerUser.id },
  });

  const barberPhone = '09101112234';
  const barberUser = await prisma.user.upsert({
    where: { phone: barberPhone },
    update: { role: UserRole.EMPLOYEE, name: 'E2E Barber' },
    create: {
      name: 'E2E Barber',
      phone: barberPhone,
      email: 'e2e.barber@doocard.local.test',
      password: passwordHash,
      role: UserRole.EMPLOYEE,
    },
  });
  const employee = await prisma.employee.upsert({
    where: { userId: barberUser.id },
    update: { isActive: true, specialty: 'E2E' },
    create: { userId: barberUser.id, isActive: true, specialty: 'E2E' },
  });

  const service = await prisma.service.upsert({
    where: { id: (
      await prisma.service.findFirst({ where: { name: 'E2E Haircut' } })
    )?.id ?? -1 },
    update: { durationMinutes: 30, price: 500000 },
    create: { name: 'E2E Haircut', durationMinutes: 30, price: 500000, description: 'E2E' },
  }).catch(async () => {
    const existing = await prisma.service.findFirst({ where: { name: 'E2E Haircut' } });
    if (existing) {
      return prisma.service.update({
        where: { id: existing.id },
        data: { durationMinutes: 30, price: 500000 },
      });
    }
    return prisma.service.create({
      data: { name: 'E2E Haircut', durationMinutes: 30, price: 500000, description: 'E2E' },
    });
  });

  await prisma.employeeService.upsert({
    where: { employeeId_serviceId: { employeeId: employee.id, serviceId: service.id } },
    update: {},
    create: { employeeId: employee.id, serviceId: service.id },
  });

  for (let weekday = 0; weekday <= 6; weekday += 1) {
    await prisma.workSchedule.upsert({
      where: {
        employeeId_weekday_startTime: {
          employeeId: employee.id,
          weekday,
          startTime: '09:00',
        },
      },
      update: { endTime: '21:00', isActive: true },
      create: {
        employeeId: employee.id,
        weekday,
        startTime: '09:00',
        endTime: '21:00',
        isActive: true,
      },
    });
  }

  const category = await prisma.productCategory.upsert({
    where: { id: (await prisma.productCategory.findFirst({ where: { name: 'E2E' } }))?.id ?? -1 },
    update: {},
    create: { name: 'E2E' },
  }).catch(async () => {
    const existing = await prisma.productCategory.findFirst({ where: { name: 'E2E' } });
    if (existing) return existing;
    return prisma.productCategory.create({ data: { name: 'E2E' } });
  });

  const products = [
    { name: 'E2E Fixed Price', isPriceVisible: true, priceRial: 2500000n, stock: 20 },
    { name: 'E2E Quote Product', isPriceVisible: false, priceRial: 0n, stock: 20 },
    { name: 'E2E Out Of Stock', isPriceVisible: true, priceRial: 1800000n, stock: 0 },
  ];
  for (const row of products) {
    const existing = await prisma.product.findFirst({ where: { name: row.name } });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { ...row, categoryId: category.id, isActive: true },
      });
    } else {
      await prisma.product.create({
        data: { ...row, categoryId: category.id, isActive: true, images: [] },
      });
    }
  }

  fs.mkdirSync(path.dirname(FRONTEND_ENV), { recursive: true });
  fs.writeFileSync(
    FRONTEND_ENV,
    JSON.stringify(
      {
        E2E_CUSTOMER_IDENTIFIER: PHONE,
        E2E_CUSTOMER_PASSWORD: password,
      },
      null,
      2,
    ),
  );
  console.log('E2E seed complete (credentials written to gitignored cypress.env.json; values not printed)');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : 'seed failed');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
