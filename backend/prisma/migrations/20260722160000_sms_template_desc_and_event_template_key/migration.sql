-- SMS admin panel gap-close: template description + event templateKey (local-first).
-- Does not alter send provider behavior.

ALTER TABLE "sms_templates" ADD COLUMN IF NOT EXISTS "description" TEXT;

ALTER TABLE "sms_events" ADD COLUMN IF NOT EXISTS "templateKey" TEXT;

CREATE INDEX IF NOT EXISTS "sms_events_templateKey_idx" ON "sms_events"("templateKey");
