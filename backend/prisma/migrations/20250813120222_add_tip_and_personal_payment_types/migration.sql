-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."TransactionCategory" ADD VALUE 'TIP';
ALTER TYPE "public"."TransactionCategory" ADD VALUE 'PERSONAL_PAYMENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."TransactionType" ADD VALUE 'TIP';
ALTER TYPE "public"."TransactionType" ADD VALUE 'PERSONAL_PAYMENT';

-- DropForeignKey
ALTER TABLE "public"."financial_entries" DROP CONSTRAINT "financial_entries_categoryId_fkey";

-- AlterTable
ALTER TABLE "public"."financial_entries" ALTER COLUMN "categoryId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."financial_entries" ADD CONSTRAINT "financial_entries_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."financial_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
