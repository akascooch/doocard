-- AlterEnum
ALTER TYPE "public"."TransactionType" ADD VALUE 'TRANSFER';

-- AlterTable
ALTER TABLE "public"."transactions" ADD COLUMN     "destinationAccountId" INTEGER;

-- CreateIndex
CREATE INDEX "transactions_destinationAccountId_idx" ON "public"."transactions"("destinationAccountId");

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "public"."bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
