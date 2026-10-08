-- Multi-barber booking group link, and append-only checkout amount audit.
-- Does not rewrite priceOverrideReason or historical appointment amounts.

ALTER TABLE "appointments" ADD COLUMN "bookingGroupId" TEXT;
ALTER TABLE "appointments" ADD COLUMN "settlementAmountAudits" JSONB;

CREATE INDEX "appointments_bookingGroupId_idx" ON "appointments"("bookingGroupId");
