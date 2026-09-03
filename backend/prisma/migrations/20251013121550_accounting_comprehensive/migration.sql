/*
  Warnings:

  - You are about to drop the column `method` on the `transactions` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `transactions` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `BigInt`.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."PaymentMethod" ADD VALUE 'TRANSFER';
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'CHEQUE';

-- AlterEnum
ALTER TYPE "public"."TransactionType" ADD VALUE 'INCOME';

-- AlterEnum
ALTER TYPE "public"."UserRole" ADD VALUE 'ACCOUNTANT';

-- AlterTable
ALTER TABLE "public"."transactions" DROP COLUMN "method",
ADD COLUMN     "accountId" INTEGER,
ADD COLUMN     "categoryId" INTEGER,
ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'IRR',
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "meta" JSONB,
ADD COLUMN     "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "paymentMethod" "public"."PaymentMethod",
ADD COLUMN     "sourceId" INTEGER,
ADD COLUMN     "sourceType" TEXT,
ALTER COLUMN "amount" SET DATA TYPE BIGINT;

-- CreateTable
CREATE TABLE "public"."transaction_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."TransactionType" NOT NULL,
    "description" TEXT,
    "parentId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bank_accounts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT,
    "accountNo" TEXT,
    "cardNo" TEXT,
    "iban" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transactions_sourceType_sourceId_idx" ON "public"."transactions"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "transactions_type_occurredAt_idx" ON "public"."transactions"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "transactions_accountId_idx" ON "public"."transactions"("accountId");

-- CreateIndex
CREATE INDEX "transactions_categoryId_idx" ON "public"."transactions"("categoryId");

-- CreateIndex
CREATE INDEX "transactions_deletedAt_idx" ON "public"."transactions"("deletedAt");

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."transaction_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transaction_categories" ADD CONSTRAINT "transaction_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."transaction_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
