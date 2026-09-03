-- AlterTable
ALTER TABLE "sms_events" ADD COLUMN "dedupeKey" TEXT,
ADD COLUMN "eventKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sms_events_dedupeKey_key" ON "sms_events"("dedupeKey");

-- CreateIndex
CREATE INDEX "sms_events_eventKey_idx" ON "sms_events"("eventKey");

-- CreateTable
CREATE TABLE "sms_notification_rules" (
    "id" SERIAL NOT NULL,
    "eventKey" TEXT NOT NULL,
    "label" TEXT,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sms_notification_rules_eventKey_key" ON "sms_notification_rules"("eventKey");
