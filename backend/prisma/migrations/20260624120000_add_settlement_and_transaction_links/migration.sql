-- CreateEnum
CREATE TYPE "EmployeeCommissionSettlementStatus" AS ENUM ('ACTIVE', 'REVERSED');

-- CreateEnum
CREATE TYPE "EmployeeCommissionSettlementTransactionRole" AS ENUM ('PRIOR_WITHDRAWAL', 'FINAL_SETTLEMENT');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN "lastCommissionSettlementAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "financiallyLockedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "employeeId" INTEGER;

-- AlterTable
ALTER TABLE "transaction_categories" ADD COLUMN "code" TEXT;
ALTER TABLE "transaction_categories" ADD COLUMN "requiresEmployee" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "employee_commission_settlements" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "periodStartAt" TIMESTAMP(3) NOT NULL,
    "periodEndAt" TIMESTAMP(3) NOT NULL,
    "periodStartJalali" TEXT,
    "periodEndJalali" TEXT,
    "commissionPercentage" DOUBLE PRECISION NOT NULL,
    "appointmentCount" INTEGER NOT NULL,
    "grossAppointmentTotalRial" BIGINT NOT NULL,
    "grossEmployeeShareRial" BIGINT NOT NULL,
    "deductionPerAppointmentRial" BIGINT NOT NULL,
    "totalAppointmentDeductionRial" BIGINT NOT NULL,
    "priorWithdrawalsTotalRial" BIGINT NOT NULL,
    "netPayableRial" BIGINT NOT NULL,
    "settlementTransactionId" INTEGER,
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" INTEGER,
    "status" "EmployeeCommissionSettlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_commission_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_commission_settlement_appointments" (
    "settlementId" INTEGER NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "appointmentAmountRial" BIGINT NOT NULL,
    "employeeShareRial" BIGINT NOT NULL,
    "appointmentDeductionRial" BIGINT NOT NULL,

    CONSTRAINT "employee_commission_settlement_appointments_pkey" PRIMARY KEY ("settlementId","appointmentId")
);

-- CreateTable
CREATE TABLE "employee_commission_settlement_transactions" (
    "settlementId" INTEGER NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "amountRial" BIGINT NOT NULL,
    "role" "EmployeeCommissionSettlementTransactionRole" NOT NULL,

    CONSTRAINT "employee_commission_settlement_transactions_pkey" PRIMARY KEY ("settlementId","transactionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_commission_settlements_settlementTransactionId_key" ON "employee_commission_settlements"("settlementTransactionId");

-- CreateIndex
CREATE INDEX "employee_commission_settlements_employeeId_status_settledAt_idx" ON "employee_commission_settlements"("employeeId", "status", "settledAt");

-- CreateIndex
CREATE UNIQUE INDEX "employee_commission_settlement_appointments_appointmentId_key" ON "employee_commission_settlement_appointments"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_categories_code_key" ON "transaction_categories"("code");

-- CreateIndex
CREATE INDEX "transactions_employeeId_occurredAt_idx" ON "transactions"("employeeId", "occurredAt");

-- CreateIndex
CREATE INDEX "transactions_employeeId_type_deletedAt_idx" ON "transactions"("employeeId", "type", "deletedAt");

-- CreateIndex
CREATE INDEX "appointments_financiallyLockedAt_idx" ON "appointments"("financiallyLockedAt");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_commission_settlements" ADD CONSTRAINT "employee_commission_settlements_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_commission_settlements" ADD CONSTRAINT "employee_commission_settlements_settlementTransactionId_fkey" FOREIGN KEY ("settlementTransactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_commission_settlement_appointments" ADD CONSTRAINT "employee_commission_settlement_appointments_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "employee_commission_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_commission_settlement_appointments" ADD CONSTRAINT "employee_commission_settlement_appointments_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_commission_settlement_transactions" ADD CONSTRAINT "employee_commission_settlement_transactions_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "employee_commission_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_commission_settlement_transactions" ADD CONSTRAINT "employee_commission_settlement_transactions_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed employee-related category codes (idempotent by code)
INSERT INTO "transaction_categories" ("name", "code", "requiresEmployee", "type", "isActive", "createdAt", "updatedAt")
SELECT 'برداشت کارمند', 'EMPLOYEE_WITHDRAWAL', true, 'EXPENSE', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "transaction_categories" WHERE "code" = 'EMPLOYEE_WITHDRAWAL');

INSERT INTO "transaction_categories" ("name", "code", "requiresEmployee", "type", "isActive", "createdAt", "updatedAt")
SELECT 'تسویه کمیسیون', 'COMMISSION_SETTLEMENT', true, 'EXPENSE', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "transaction_categories" WHERE "code" = 'COMMISSION_SETTLEMENT');

INSERT INTO "transaction_categories" ("name", "code", "requiresEmployee", "type", "isActive", "createdAt", "updatedAt")
SELECT 'علی‌الحساب حقوق', 'SALARY_ADVANCE', true, 'EXPENSE', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "transaction_categories" WHERE "code" = 'SALARY_ADVANCE');

UPDATE "transaction_categories"
SET "code" = 'PAYROLL', "requiresEmployee" = true
WHERE "code" IS NULL AND "name" IN ('حقوق و دستمزد', 'هزینه حقوق') AND "type" = 'EXPENSE';
