-- Additive audit field. Existing appointments stay NULL.
ALTER TABLE "appointments" ADD COLUMN "priceOverrideReason" TEXT;
