-- Ensure all Location contact columns exist (idempotent - safe if run multiple times)
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "locationName" TEXT;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "website" TEXT;
