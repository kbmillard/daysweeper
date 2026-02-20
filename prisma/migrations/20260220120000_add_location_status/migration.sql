-- AlterTable
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "status" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Location_status_idx" ON "Location"("status");
