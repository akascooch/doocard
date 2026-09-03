-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ChequeLeafCategory" AS ENUM ('NORMAL', 'GUARANTEE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "cheque_leaves"
  ADD COLUMN IF NOT EXISTS "category" "ChequeLeafCategory" NOT NULL DEFAULT 'NORMAL';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cheque_leaves_category_idx" ON "cheque_leaves"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cheque_leaves_dueDate_status_idx" ON "cheque_leaves"("dueDate", "status");
