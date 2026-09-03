-- Historical stub restored for local migrate history parity.
-- Applied on local DB; original folder was missing from the repo.
-- Schema already present: employee_withdrawal_requests + WithdrawalStatus extensions.

DO $$ BEGIN
  CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "employee_withdrawal_requests" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedById" INTEGER,
    "note" TEXT,
    "transactionId" INTEGER,

    CONSTRAINT "employee_withdrawal_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_withdrawal_requests_transactionId_key"
  ON "employee_withdrawal_requests"("transactionId");

CREATE INDEX IF NOT EXISTS "employee_withdrawal_requests_employeeId_status_idx"
  ON "employee_withdrawal_requests"("employeeId", "status");

CREATE INDEX IF NOT EXISTS "employee_withdrawal_requests_status_requestedAt_idx"
  ON "employee_withdrawal_requests"("status", "requestedAt");

CREATE INDEX IF NOT EXISTS "employee_withdrawal_requests_processedById_idx"
  ON "employee_withdrawal_requests"("processedById");

DO $$ BEGIN
  ALTER TABLE "employee_withdrawal_requests"
    ADD CONSTRAINT "employee_withdrawal_requests_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("userId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_withdrawal_requests"
    ADD CONSTRAINT "employee_withdrawal_requests_processedById_fkey"
    FOREIGN KEY ("processedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "employee_withdrawal_requests"
    ADD CONSTRAINT "employee_withdrawal_requests_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "transactions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
