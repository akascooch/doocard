-- Phase 2: appointment source, multi-service packages, consumption audit, PACKAGE payment

-- 1) Appointment createdSource
DO $$ BEGIN
  CREATE TYPE "AppointmentCreatedSource" AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN', 'BARBER', 'UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "appointments"
  ADD COLUMN IF NOT EXISTS "createdSource" "AppointmentCreatedSource" NOT NULL DEFAULT 'UNKNOWN';

CREATE INDEX IF NOT EXISTS "appointments_createdSource_idx" ON "appointments"("createdSource");

-- 2) PaymentMethod PACKAGE (PostgreSQL 14-safe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PaymentMethod' AND e.enumlabel = 'PACKAGE'
  ) THEN
    ALTER TYPE "PaymentMethod" ADD VALUE 'PACKAGE';
  END IF;
END $$;

-- 3) Multi-service package templates (junction)
CREATE TABLE IF NOT EXISTS "service_package_template_services" (
  "id" TEXT NOT NULL,
  "packageTemplateId" TEXT NOT NULL,
  "serviceId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_package_template_services_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_package_template_services_packageTemplateId_serviceId_key"
  ON "service_package_template_services"("packageTemplateId", "serviceId");

CREATE INDEX IF NOT EXISTS "service_package_template_services_serviceId_idx"
  ON "service_package_template_services"("serviceId");

DO $$ BEGIN
  ALTER TABLE "service_package_template_services"
    ADD CONSTRAINT "service_package_template_services_packageTemplateId_fkey"
    FOREIGN KEY ("packageTemplateId") REFERENCES "service_package_templates"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "service_package_template_services"
    ADD CONSTRAINT "service_package_template_services_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "services"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Backfill junction from legacy single serviceId
INSERT INTO "service_package_template_services" ("id", "packageTemplateId", "serviceId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || t."id"::text), t."id", t."serviceId", CURRENT_TIMESTAMP
FROM "service_package_templates" t
WHERE t."serviceId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "service_package_template_services" j
    WHERE j."packageTemplateId" = t."id" AND j."serviceId" = t."serviceId"
  );

-- Keep serviceId for backward-compatible reads; allow null for new multi-only rows later
ALTER TABLE "service_package_templates" ALTER COLUMN "serviceId" DROP NOT NULL;

-- 4) Package consumption audit fields
ALTER TABLE "customer_package_consumptions"
  ADD COLUMN IF NOT EXISTS "serviceId" INTEGER,
  ADD COLUMN IF NOT EXISTS "consumedByUserId" INTEGER;

DO $$ BEGIN
  ALTER TABLE "customer_package_consumptions"
    ADD CONSTRAINT "customer_package_consumptions_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "services"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "customer_package_consumptions"
    ADD CONSTRAINT "customer_package_consumptions_consumedByUserId_fkey"
    FOREIGN KEY ("consumedByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Replace single-appointment uniqueness with package+appointment+service
ALTER TABLE "customer_package_consumptions"
  DROP CONSTRAINT IF EXISTS "customer_package_consumptions_appointmentId_key";

DROP INDEX IF EXISTS "customer_package_consumptions_appointmentId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "customer_package_consumptions_pkg_appt_service_key"
  ON "customer_package_consumptions"("customerPackageId", "appointmentId", "serviceId");
