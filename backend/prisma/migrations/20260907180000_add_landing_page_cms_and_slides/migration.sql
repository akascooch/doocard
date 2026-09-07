-- Landing CMS: homepage contact/hero fields, gallery slides, employee showcase.

ALTER TABLE "homepage_details" ADD COLUMN IF NOT EXISTS "heroTitle" TEXT;
ALTER TABLE "homepage_details" ADD COLUMN IF NOT EXISTS "heroSubtitle" TEXT;
ALTER TABLE "homepage_details" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "homepage_details" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "homepage_details" ADD COLUMN IF NOT EXISTS "instagramUrl" TEXT;
ALTER TABLE "homepage_details" ADD COLUMN IF NOT EXISTS "workingHours" TEXT;

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "displayTitle" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "showOnLanding" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "landingSortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "landing_slides" (
    "id" SERIAL NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_slides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "landing_slides_isActive_sortOrder_idx" ON "landing_slides"("isActive", "sortOrder");
