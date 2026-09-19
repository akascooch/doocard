-- Optional loyalty threshold for service package templates.
ALTER TABLE "service_package_templates" ADD COLUMN IF NOT EXISTS "pointsRequired" INTEGER;
