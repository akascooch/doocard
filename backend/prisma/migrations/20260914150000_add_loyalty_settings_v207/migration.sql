-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "loyaltyRateRialPerPoint" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "loyaltyMinRedeemPoints" INTEGER NOT NULL DEFAULT 100;
