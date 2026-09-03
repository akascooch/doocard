/*
  Warnings:

  - You are about to drop the `TipTransaction` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `endDate` to the `salaries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `salaries` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE 'SERVICE';

-- AlterTable
ALTER TABLE "public"."_BarberToService" ADD CONSTRAINT "_BarberToService_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "public"."_BarberToService_AB_unique";

-- AlterTable
ALTER TABLE "public"."salaries" ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "salaryType" TEXT NOT NULL DEFAULT 'REGULAR',
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."transactions" ADD COLUMN     "barberId" INTEGER,
ADD COLUMN     "transactionType" TEXT NOT NULL DEFAULT 'SERVICE';

-- DropTable
DROP TABLE "public"."TipTransaction";

-- CreateTable
CREATE TABLE "public"."tip_transactions" (
    "id" SERIAL NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staffId" INTEGER,
    "appointmentId" INTEGER,
    "type" "public"."TipTransactionType" NOT NULL,
    "status" "public"."TipTransactionStatus" NOT NULL DEFAULT 'pending',
    "createdById" INTEGER,
    "description" TEXT,

    CONSTRAINT "tip_transactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "public"."barbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tip_transactions" ADD CONSTRAINT "tip_transactions_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "public"."barbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
