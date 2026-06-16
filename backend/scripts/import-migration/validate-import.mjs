import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

const types = ['INCOME', 'EXPENSE', 'TIP', 'SERVICE', 'SALARY', 'TRANSFER'];
const transactionsByType = [];
for (const type of types) {
  const count = await p.transaction.count({ where: { deletedAt: null, type } });
  if (count > 0) transactionsByType.push({ type, count });
}

const apptCount = await p.appointment.count({ where: { deletedAt: null } });
const apptSvc = await p.appointmentService.count();
const bank = await p.bankAccount.findFirst({
  where: { isDefault: true },
  select: { id: true, name: true, balance: true },
});

const incomeSum = await p.transaction.aggregate({
  where: { deletedAt: null, type: 'INCOME', accountId: bank?.id },
  _sum: { amount: true },
});
const expenseSum = await p.transaction.aggregate({
  where: { deletedAt: null, type: 'EXPENSE', accountId: bank?.id },
  _sum: { amount: true },
});

const net = (incomeSum._sum.amount ?? 0n) - (expenseSum._sum.amount ?? 0n);

console.log(
  JSON.stringify(
    {
      transactionsByType,
      appointments_active: apptCount,
      appointment_services: apptSvc,
      bank: bank
        ? { id: bank.id, name: bank.name, balance: bank.balance.toString() }
        : null,
      sumsRial: {
        income: incomeSum._sum.amount?.toString(),
        expense: expenseSum._sum.amount?.toString(),
        net: net.toString(),
        balanceMatchesNet: bank ? bank.balance.toString() === net.toString() : false,
      },
    },
    null,
    2,
  ),
);

await p.$disconnect();
