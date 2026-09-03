-- AlterTable: durable special-commission policy flag (no name hardcoding in app logic)
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "isSpecialCommission" BOOLEAN NOT NULL DEFAULT false;

-- One-time local bootstrap: mark known special-commission employees by linked user name.
-- Application code must use isSpecialCommission only — never match Persian names at runtime.
UPDATE "employees" e
SET "isSpecialCommission" = true,
    "updatedAt" = NOW()
FROM "users" u
WHERE e."userId" = u.id
  AND (
    u.name = 'آرش بهمن'
    OR u.name = 'اشکان اشتیش'
  );
