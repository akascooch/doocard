-- Allow multiple frog tasks per admin per Tehran day; add due instant + SMS reminder tracking.
-- Existing rows keep their dateKey; scheduledAt is noon Asia/Tehran that day.

DROP INDEX IF EXISTS "admin_daily_frogs_userId_dateKey_key";

ALTER TABLE "admin_daily_frogs" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "admin_daily_frogs" ADD COLUMN IF NOT EXISTS "reminderSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "admin_daily_frogs" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);

-- Store UTC wall-clock (Prisma DateTime) for noon Asia/Tehran, independent of session TimeZone.
UPDATE "admin_daily_frogs"
SET "scheduledAt" = (("dateKey" || 'T12:00:00+03:30')::timestamptz AT TIME ZONE 'UTC')
WHERE "scheduledAt" IS NULL;

ALTER TABLE "admin_daily_frogs" ALTER COLUMN "scheduledAt" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "admin_daily_frogs_isCompleted_reminderSent_scheduledAt_idx"
  ON "admin_daily_frogs"("isCompleted", "reminderSent", "scheduledAt");
