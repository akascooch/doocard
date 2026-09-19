-- Dual frog reminders: keep legacy reminderSent, add 2h + 15m flags.
-- Backfill 2h from the existing one-shot column.

ALTER TABLE "admin_daily_frogs" ADD COLUMN IF NOT EXISTS "reminder2hSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "admin_daily_frogs" ADD COLUMN IF NOT EXISTS "reminder2hSentAt" TIMESTAMP(3);
ALTER TABLE "admin_daily_frogs" ADD COLUMN IF NOT EXISTS "reminder15mSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "admin_daily_frogs" ADD COLUMN IF NOT EXISTS "reminder15mSentAt" TIMESTAMP(3);

UPDATE "admin_daily_frogs"
SET
  "reminder2hSent" = "reminderSent",
  "reminder2hSentAt" = "reminderSentAt"
WHERE "reminder2hSent" = false AND "reminderSent" = true;

CREATE INDEX IF NOT EXISTS "admin_daily_frogs_isCompleted_reminder2hSent_scheduledAt_idx"
  ON "admin_daily_frogs"("isCompleted", "reminder2hSent", "scheduledAt");

CREATE INDEX IF NOT EXISTS "admin_daily_frogs_isCompleted_reminder15mSent_scheduledAt_idx"
  ON "admin_daily_frogs"("isCompleted", "reminder15mSent", "scheduledAt");
