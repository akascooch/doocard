-- Personal ledger direction. Existing rows stay EXPENSE.
CREATE TYPE "AdminPersonalEntryDirection" AS ENUM ('INCOME', 'EXPENSE');

ALTER TABLE "admin_personal_expenses"
ADD COLUMN "direction" "AdminPersonalEntryDirection" NOT NULL DEFAULT 'EXPENSE';

CREATE INDEX "admin_personal_expenses_userId_direction_idx"
ON "admin_personal_expenses"("userId", "direction");
