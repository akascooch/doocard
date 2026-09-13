-- Additive admin personal suite (daily frog + petty cash). No existing tables altered.

CREATE TYPE "AdminFrogStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');
CREATE TYPE "AdminPersonalExpenseCategory" AS ENUM (
  'SALON_SUPPLIES',
  'FOOD_REFRESHMENT',
  'PETTY_CASH',
  'UTILITY',
  'PERSONAL'
);

CREATE TABLE "admin_daily_frogs" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "dateKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "AdminFrogStatus" NOT NULL DEFAULT 'PENDING',
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_daily_frogs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_daily_frogs_userId_dateKey_key" ON "admin_daily_frogs"("userId", "dateKey");
CREATE INDEX "admin_daily_frogs_userId_dateKey_idx" ON "admin_daily_frogs"("userId", "dateKey");
CREATE INDEX "admin_daily_frogs_userId_isCompleted_idx" ON "admin_daily_frogs"("userId", "isCompleted");

ALTER TABLE "admin_daily_frogs"
  ADD CONSTRAINT "admin_daily_frogs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "admin_personal_expenses" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "category" "AdminPersonalExpenseCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dateKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_personal_expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_personal_expenses_userId_dateKey_idx" ON "admin_personal_expenses"("userId", "dateKey");
CREATE INDEX "admin_personal_expenses_userId_category_idx" ON "admin_personal_expenses"("userId", "category");
CREATE INDEX "admin_personal_expenses_userId_occurredAt_idx" ON "admin_personal_expenses"("userId", "occurredAt");

ALTER TABLE "admin_personal_expenses"
  ADD CONSTRAINT "admin_personal_expenses_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
