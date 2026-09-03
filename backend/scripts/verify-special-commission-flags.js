/* LOCAL READ-ONLY validation of special commission flags */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  try {
    const rows = await p.employee.findMany({
      where: { id: { in: [3, 4] } },
      select: {
        id: true,
        isSpecialCommission: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { id: 'asc' },
    });
    const othersTrue = await p.employee.count({
      where: {
        isSpecialCommission: true,
        id: { notIn: [3, 4] },
      },
    });
    console.log(
      JSON.stringify(
        {
          specialEmployees: rows.map((r) => ({
            employeeId: r.id,
            userId: r.user.id,
            name: r.user.name,
            isSpecialCommission: r.isSpecialCommission,
          })),
          otherEmployeesWithFlagTrue: othersTrue,
          allTargetFlagsTrue: rows.length === 2 && rows.every((r) => r.isSpecialCommission === true),
        },
        null,
        2,
      ),
    );
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
