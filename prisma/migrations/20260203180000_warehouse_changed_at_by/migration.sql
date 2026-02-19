-- AlterTable
ALTER TABLE "WarehouseItem" ADD COLUMN IF NOT EXISTS "changedAt" TIMESTAMP(3);
ALTER TABLE "WarehouseItem" ADD COLUMN IF NOT EXISTS "changedBy" TEXT;
