-- Additive only. Existing users stay unverified (NULL).
-- Does not rewrite refresh token rows.
ALTER TABLE "users" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
