-- Appointment integrity audit (run manually; do NOT auto-execute in production)
-- Parentheses required: AND binds tighter than OR.

-- Query 1: count rows with missing FK relations
SELECT COUNT(*)
FROM appointments
WHERE ("serviceId" IS NULL OR "employeeId" IS NULL)
  AND "deletedAt" IS NULL;

-- Query 2: sample affected rows
SELECT id, "serviceId", "employeeId", status, "scheduledAt"
FROM appointments
WHERE ("serviceId" IS NULL OR "employeeId" IS NULL)
  AND "deletedAt" IS NULL
LIMIT 50;

-- Query 3: schema parity check (compare output on LOCAL vs PRODUCTION)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'appointments'
ORDER BY ordinal_position;

-- Safe repair: backfill serviceId from services JSON snapshot (Int, not UUID)
-- Only when JSON contains serviceId and legacy column is NULL.
UPDATE appointments
SET "serviceId" = (services->0->>'serviceId')::int
WHERE "serviceId" IS NULL
  AND services IS NOT NULL
  AND jsonb_typeof(services::jsonb) = 'array'
  AND jsonb_array_length(services::jsonb) > 0
  AND (services->0->>'serviceId') IS NOT NULL
  AND "deletedAt" IS NULL;

-- employeeId NULL: intentionally left unchanged (unassigned employee is valid).
