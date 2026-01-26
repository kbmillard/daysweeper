-- AlterTable
ALTER TABLE "Route" RENAME COLUMN "createdAt" TO "created";

-- AlterTable
ALTER TABLE "Route" ADD COLUMN IF NOT EXISTS "assignedToName" TEXT,
ADD COLUMN IF NOT EXISTS "assignedToEmail" TEXT,
ADD COLUMN IF NOT EXISTS "assignedToExternalId" TEXT;
