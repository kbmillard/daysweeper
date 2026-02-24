-- CreateTable
CREATE TABLE "MapPin" (
    "id" TEXT NOT NULL,
    "latitude" DECIMAL(10,6) NOT NULL,
    "longitude" DECIMAL(11,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MapPin_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MapPin_latitude_longitude_idx" ON "MapPin"("latitude", "longitude");

-- CreateTable
CREATE TABLE "HiddenDot" (
    "id" TEXT NOT NULL,
    "latitude" DECIMAL(10,6) NOT NULL,
    "longitude" DECIMAL(11,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiddenDot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HiddenDot_latitude_longitude_key" ON "HiddenDot"("latitude", "longitude");
CREATE INDEX "HiddenDot_latitude_longitude_idx" ON "HiddenDot"("latitude", "longitude");
