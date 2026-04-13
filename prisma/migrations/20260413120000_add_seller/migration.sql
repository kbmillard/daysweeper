-- CreateTable
CREATE TABLE "Seller" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressRaw" TEXT NOT NULL DEFAULT '',
    "addressNormalized" TEXT,
    "addressComponents" JSONB,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "phone" TEXT,
    "website" TEXT,
    "role" TEXT,
    "notes" TEXT,
    "importCategory" TEXT,
    "legacyJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seller_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Seller_externalId_key" ON "Seller"("externalId");

-- CreateIndex
CREATE INDEX "Seller_importCategory_idx" ON "Seller"("importCategory");
