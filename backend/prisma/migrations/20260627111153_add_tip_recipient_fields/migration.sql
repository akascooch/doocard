-- CreateEnum
CREATE TYPE "TipRecipientType" AS ENUM ('INDIVIDUAL', 'TEAM');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SERVICE';

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "tipRecipientEmployeeId" INTEGER,
ADD COLUMN     "tipRecipientType" "TipRecipientType",
ADD COLUMN     "tipSalonShareRial" BIGINT,
ADD COLUMN     "tipStaffShareRial" BIGINT;

-- CreateTable
CREATE TABLE "appointment_tip_allocations" (
    "id" SERIAL NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "amountRial" BIGINT NOT NULL,
    "paidInSettlementId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_tip_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointment_tip_allocations_appointmentId_idx" ON "appointment_tip_allocations"("appointmentId");

-- CreateIndex
CREATE INDEX "appointment_tip_allocations_employeeId_idx" ON "appointment_tip_allocations"("employeeId");

-- CreateIndex
CREATE INDEX "appointment_tip_allocations_paidInSettlementId_idx" ON "appointment_tip_allocations"("paidInSettlementId");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tipRecipientEmployeeId_fkey" FOREIGN KEY ("tipRecipientEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_tip_allocations" ADD CONSTRAINT "appointment_tip_allocations_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_tip_allocations" ADD CONSTRAINT "appointment_tip_allocations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_tip_allocations" ADD CONSTRAINT "appointment_tip_allocations_paidInSettlementId_fkey" FOREIGN KEY ("paidInSettlementId") REFERENCES "employee_commission_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
