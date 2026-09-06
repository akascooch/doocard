-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ChequePayeeKind" AS ENUM ('STAFF_SALARY', 'SUPPLIER', 'RENT', 'UTILITIES', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "cheque_leaves"
  ADD COLUMN IF NOT EXISTS "payeeKind" "ChequePayeeKind",
  ADD COLUMN IF NOT EXISTS "employeeId" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cheque_leaves_payeeKind_idx" ON "cheque_leaves"("payeeKind");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cheque_leaves_employeeId_idx" ON "cheque_leaves"("employeeId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "cheque_leaves"
    ADD CONSTRAINT "cheque_leaves_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
