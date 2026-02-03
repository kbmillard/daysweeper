-- CreateTable (IF NOT EXISTS for idempotency when table was created elsewhere)
CREATE TABLE IF NOT EXISTS "WarehouseItem" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "description" TEXT,
    "bin" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "price" DECIMAL(12,2),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MetaKV" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaKV_pkey" PRIMARY KEY ("key")
);

-- CreateIndex (IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS "WarehouseItem_partNumber_key" ON "WarehouseItem"("partNumber");
CREATE INDEX IF NOT EXISTS "WarehouseItem_partNumber_idx" ON "WarehouseItem"("partNumber");
CREATE INDEX IF NOT EXISTS "WarehouseItem_bin_idx" ON "WarehouseItem"("bin");
