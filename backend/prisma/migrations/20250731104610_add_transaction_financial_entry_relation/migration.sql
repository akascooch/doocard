/*
  Warnings:

  - You are about to drop the `FinancialEntry` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FinancialEntry" DROP CONSTRAINT "FinancialEntry_bankAccountId_fkey";

-- DropForeignKey
ALTER TABLE "FinancialEntry" DROP CONSTRAINT "FinancialEntry_categoryId_fkey";

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "financialEntryId" INTEGER;

-- DropTable
DROP TABLE "FinancialEntry";

-- CreateTable
CREATE TABLE "financial_entries" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "EntryType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "categoryId" INTEGER NOT NULL,
    "reference" TEXT,
    "paymentMethod" TEXT,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "attachmentUrl" TEXT,
    "status" "EntryStatus" NOT NULL DEFAULT 'COMPLETED',
    "bankAccountId" INTEGER,

    CONSTRAINT "financial_entries_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_financialEntryId_fkey" FOREIGN KEY ("financialEntryId") REFERENCES "financial_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
