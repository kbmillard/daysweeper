-- Normalize NULL bin to empty string so compound unique (bin, partNumber) enforces one row per bin+part
UPDATE "WarehouseItem" SET "bin" = '' WHERE "bin" IS NULL;

-- Drop single-column unique so we can have same part number in different bins
DROP INDEX IF EXISTS "WarehouseItem_partNumber_key";

-- One row per (bin, part number) so 316 rows (same part in different bins) are all stored
CREATE UNIQUE INDEX IF NOT EXISTS "WarehouseItem_bin_partNumber_key" ON "WarehouseItem"("bin", "partNumber");
