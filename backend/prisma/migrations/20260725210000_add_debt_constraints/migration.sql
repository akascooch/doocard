-- Phase 3: CustomerDebt appointment FK + unique (sourceType, sourceId)
-- Safe for local migrate; dedupe before unique.

-- 1) Add appointmentId column
ALTER TABLE "customer_debts" ADD COLUMN IF NOT EXISTS "appointmentId" INTEGER;

-- 2) Backfill from soft link
UPDATE "customer_debts"
SET "appointmentId" = "sourceId"
WHERE "sourceType" = 'APPOINTMENT'
  AND "sourceId" IS NOT NULL
  AND "appointmentId" IS NULL
  AND EXISTS (SELECT 1 FROM "appointments" a WHERE a.id = "customer_debts"."sourceId");

-- 3) Remove duplicate (sourceType, sourceId) rows keeping lowest id
DELETE FROM "customer_debts" a
USING "customer_debts" b
WHERE a.id > b.id
  AND a."sourceType" IS NOT NULL
  AND a."sourceId" IS NOT NULL
  AND a."sourceType" = b."sourceType"
  AND a."sourceId" = b."sourceId";

-- 4) FK + indexes
CREATE INDEX IF NOT EXISTS "customer_debts_appointmentId_idx" ON "customer_debts"("appointmentId");

DO $$ BEGIN
  ALTER TABLE "customer_debts"
    ADD CONSTRAINT "customer_debts_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Unique: only enforced when both columns non-null (PostgreSQL NULLS DISTINCT default)
DO $$ BEGIN
  ALTER TABLE "customer_debts"
    ADD CONSTRAINT "customer_debts_sourceType_sourceId_key"
    UNIQUE ("sourceType", "sourceId");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
