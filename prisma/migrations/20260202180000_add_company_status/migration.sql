-- AlterTable
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "status" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Company_status_idx" ON "Company"("status");
