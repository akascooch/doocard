-- Additive: follow salon ledger convention (Transaction.deletedAt) for petty-cash rows.
-- Does not alter existing columns or drop data.

ALTER TABLE "admin_personal_expenses" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "admin_personal_expenses_userId_deletedAt_idx"
  ON "admin_personal_expenses"("userId", "deletedAt");
