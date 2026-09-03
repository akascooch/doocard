/*
  Warnings:

  - You are about to drop the column `appointmentDate` on the `appointments` table. All the data in the column will be lost.
  - Added the required column `durationMin` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scheduledAt` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `services` to the `appointments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AppointmentStatus" ADD VALUE 'PAID';
ALTER TYPE "AppointmentStatus" ADD VALUE 'SETTLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethod" ADD VALUE 'CARD2CARD';
ALTER TYPE "PaymentMethod" ADD VALUE 'DEBT';

-- DropForeignKey
ALTER TABLE "public"."appointments" DROP CONSTRAINT "appointments_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."appointments" DROP CONSTRAINT "appointments_serviceId_fkey";

-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "appointmentDate",
ADD COLUMN     "accountId" INTEGER,
ADD COLUMN     "amount" BIGINT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "durationMin" INTEGER NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paidBy" INTEGER,
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "scheduledAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "services" JSONB NOT NULL,
ADD COLUMN     "tipAmount" BIGINT,
ALTER COLUMN "employeeId" DROP NOT NULL,
ALTER COLUMN "serviceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "preferredDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "customer_debts" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "sourceType" TEXT,
    "sourceId" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "settledBy" INTEGER,
    "meta" JSONB,

    CONSTRAINT "customer_debts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_debts_customerId_idx" ON "customer_debts"("customerId");

-- CreateIndex
CREATE INDEX "customer_debts_settledAt_idx" ON "customer_debts"("settledAt");

-- CreateIndex
CREATE INDEX "appointments_customerId_idx" ON "appointments"("customerId");

-- CreateIndex
CREATE INDEX "appointments_employeeId_idx" ON "appointments"("employeeId");

-- CreateIndex
CREATE INDEX "appointments_scheduledAt_idx" ON "appointments"("scheduledAt");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE INDEX "appointments_deletedAt_idx" ON "appointments"("deletedAt");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_paidBy_fkey" FOREIGN KEY ("paidBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_debts" ADD CONSTRAINT "customer_debts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_debts" ADD CONSTRAINT "customer_debts_settledBy_fkey" FOREIGN KEY ("settledBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
