-- Employee-loan mode on lottery_groups: optional circle account, total principal, start period.
-- Plus durable installment application rows with DB uniqueness for concurrent apply safety.
-- Do not apply during local implementation unless an isolated test DB is used.
ALTER TABLE "lottery_groups" ALTER COLUMN "circleAccountId" DROP NOT NULL;
ALTER TABLE "lottery_groups" ADD COLUMN IF NOT EXISTS "totalLoanAmountRial" BIGINT;
ALTER TABLE "lottery_groups" ADD COLUMN IF NOT EXISTS "startPeriodYm" TEXT;

CREATE TABLE IF NOT EXISTS "lottery_loan_installment_events" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "amountRial" BIGINT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "transactionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lottery_loan_installment_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lottery_loan_installment_events_idempotencyKey_key"
  ON "lottery_loan_installment_events"("idempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "lottery_loan_installment_events_transactionId_key"
  ON "lottery_loan_installment_events"("transactionId");

CREATE UNIQUE INDEX IF NOT EXISTS "lottery_loan_installment_events_groupId_employeeId_periodKey_key"
  ON "lottery_loan_installment_events"("groupId", "employeeId", "periodKey");

CREATE INDEX IF NOT EXISTS "lottery_loan_installment_events_employeeId_periodKey_idx"
  ON "lottery_loan_installment_events"("employeeId", "periodKey");

CREATE INDEX IF NOT EXISTS "lottery_loan_installment_events_groupId_periodKey_idx"
  ON "lottery_loan_installment_events"("groupId", "periodKey");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lottery_loan_installment_events_groupId_fkey'
  ) THEN
    ALTER TABLE "lottery_loan_installment_events"
      ADD CONSTRAINT "lottery_loan_installment_events_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "lottery_groups"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lottery_loan_installment_events_memberId_fkey'
  ) THEN
    ALTER TABLE "lottery_loan_installment_events"
      ADD CONSTRAINT "lottery_loan_installment_events_memberId_fkey"
      FOREIGN KEY ("memberId") REFERENCES "lottery_members"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lottery_loan_installment_events_employeeId_fkey'
  ) THEN
    ALTER TABLE "lottery_loan_installment_events"
      ADD CONSTRAINT "lottery_loan_installment_events_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
