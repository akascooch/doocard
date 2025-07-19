-- DropIndex
DROP INDEX "customers_email_key";

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "email" DROP NOT NULL;
