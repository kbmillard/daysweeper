-- CreateTable
CREATE TABLE "MapPin" (
    "id" TEXT NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapPin_pkey" PRIMARY KEY ("id")
);
