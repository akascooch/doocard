CREATE TABLE IF NOT EXISTS sms_events (
  id SERIAL PRIMARY KEY,
  "appointmentId" INT,
  "to" TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL,
  "providerResp" TEXT,
  attempts INT DEFAULT 0,
  "lastAttemptAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sms_events_appointment ON sms_events("appointmentId");
CREATE INDEX IF NOT EXISTS idx_sms_events_status ON sms_events(status);
CREATE INDEX IF NOT EXISTS idx_sms_events_created ON sms_events("createdAt");
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MANAGER';
