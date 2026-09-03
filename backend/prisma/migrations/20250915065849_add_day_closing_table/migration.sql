/*
  Warnings:

  - A unique constraint covering the columns `[appointmentId,serviceId]` on the table `appointment_services` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."appointment_services" DROP CONSTRAINT "appointment_services_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."appointment_services" DROP CONSTRAINT "appointment_services_serviceId_fkey";

-- CreateTable
CREATE TABLE "public"."day_closings" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalExpense" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTips" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSalaries" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "closedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "day_closings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "day_closings_date_key" ON "public"."day_closings"("date");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_services_appointmentId_serviceId_key" ON "public"."appointment_services"("appointmentId", "serviceId");

-- AddForeignKey
ALTER TABLE "public"."appointment_services" ADD CONSTRAINT "appointment_services_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointment_services" ADD CONSTRAINT "appointment_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."day_closings" ADD CONSTRAINT "day_closings_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
