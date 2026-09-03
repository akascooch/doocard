-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EmployeeSalaryRequestType" AS ENUM ('PAYROLL_WITHDRAWAL', 'ADVANCE', 'COMMISSION_SETTLEMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmployeeSalaryRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "tipTeamMemberIds" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_salary_requests" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "requestType" "EmployeeSalaryRequestType" NOT NULL,
    "status" "EmployeeSalaryRequestStatus" NOT NULL DEFAULT 'PENDING',
    "upToJalali" TEXT NOT NULL,
    "periodStartJalali" TEXT,
    "requestedAmountRial" BIGINT NOT NULL,
    "availableAtRequestRial" BIGINT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "destinationNote" TEXT,
    "allowNegative" BOOLEAN NOT NULL DEFAULT false,
    "reviewedByUserId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "paidByUserId" INTEGER,
    "paidAt" TIMESTAMP(3),
    "paidBankAccountId" INTEGER,
    "paymentTransactionId" INTEGER,
    "settlementId" INTEGER,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_salary_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_salary_requests_paymentTransactionId_key" ON "employee_salary_requests"("paymentTransactionId");
CREATE INDEX IF NOT EXISTS "employee_salary_requests_employeeId_status_createdAt_idx" ON "employee_salary_requests"("employeeId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "employee_salary_requests_status_createdAt_idx" ON "employee_salary_requests"("status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "employee_salary_requests" ADD CONSTRAINT "employee_salary_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_salary_requests" ADD CONSTRAINT "employee_salary_requests_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_salary_requests" ADD CONSTRAINT "employee_salary_requests_paidBankAccountId_fkey" FOREIGN KEY ("paidBankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Free EMPLOYEE_WITHDRAWAL code from duplicate category id=17 before assigning to canonical id=10
UPDATE "transaction_categories"
SET "code" = 'EMPLOYEE_WITHDRAWAL_LEGACY',
    "isActive" = false,
    "requiresEmployee" = true,
    "updatedAt" = NOW()
WHERE "id" = 17
   OR ("code" = 'EMPLOYEE_WITHDRAWAL' AND "id" <> 10);

-- Canonical category id=10
UPDATE "transaction_categories"
SET "code" = 'EMPLOYEE_WITHDRAWAL',
    "requiresEmployee" = true,
    "isActive" = true,
    "updatedAt" = NOW()
WHERE "id" = 10;

-- Remap legacy commission-settlement expenses (id=13) into canonical withdrawal ledger (id=10)
UPDATE "transactions" t
SET "categoryId" = 10,
    "meta" = COALESCE(t."meta", '{}'::jsonb) || jsonb_build_object(
      'sourceCategoryId', 13,
      'migratedFromLegacyCategory', true,
      'backfillNotes', 'Remapped from category id=13 تسویه کمیسیون to canonical id=10'
    ),
    "updatedAt" = NOW()
WHERE t."categoryId" = 13
  AND t."deletedAt" IS NULL;

UPDATE "transaction_categories"
SET "isActive" = false,
    "updatedAt" = NOW()
WHERE "id" = 13;

-- Commission rates
UPDATE "employees" e
SET "commissionRate" = 50,
    "updatedAt" = NOW()
FROM "users" u
WHERE e."userId" = u."id"
  AND u."name" IN ('اشکان اشتیش', 'آرش بهمن');

UPDATE "employees" e
SET "commissionRate" = 40,
    "updatedAt" = NOW()
FROM "users" u
WHERE e."userId" = u."id"
  AND e."commissionRate" = 0
  AND u."role" IN ('EMPLOYEE', 'SERVICE')
  AND u."name" NOT IN ('اشکان اشتیش', 'آرش بهمن');
