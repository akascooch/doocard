-- AlterEnum
ALTER TYPE "public"."UserRole" ADD VALUE 'MANAGER';

-- CreateTable
CREATE TABLE "public"."sms_events" (
    "id" SERIAL NOT NULL,
    "appointmentId" INTEGER,
    "to" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL,
    "providerResp" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sms_events_appointmentId_idx" ON "public"."sms_events"("appointmentId");

-- CreateIndex
CREATE INDEX "sms_events_status_idx" ON "public"."sms_events"("status");

-- CreateIndex
CREATE INDEX "sms_events_createdAt_idx" ON "public"."sms_events"("createdAt");
