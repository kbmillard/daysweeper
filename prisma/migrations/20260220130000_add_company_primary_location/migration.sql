-- AlterTable
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "primaryLocationId" TEXT;

-- CreateIndex (unique for 1:1 relation)
CREATE UNIQUE INDEX IF NOT EXISTS "Company_primaryLocationId_key" ON "Company"("primaryLocationId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_primaryLocationId_fkey" FOREIGN KEY ("primaryLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
