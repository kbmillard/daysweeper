-- Add hidden flag to Company and MapPin
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MapPin" ADD COLUMN IF NOT EXISTS "hidden" BOOLEAN NOT NULL DEFAULT false;

-- Hide all existing companies and map pins right now
UPDATE "Company" SET "hidden" = true;
UPDATE "MapPin" SET "hidden" = true;
