-- CreateTable
CREATE TABLE "CompanyInteraction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "orgId" TEXT,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "duration" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyInteraction_createdAt_idx" ON "CompanyInteraction"("createdAt");

-- CreateIndex
CREATE INDEX "CompanyInteraction_companyId_idx" ON "CompanyInteraction"("companyId");

-- CreateIndex
CREATE INDEX "CompanyInteraction_userId_idx" ON "CompanyInteraction"("userId");

-- CreateIndex
CREATE INDEX "CompanyInteraction_orgId_idx" ON "CompanyInteraction"("orgId");

-- CreateIndex
CREATE INDEX "CompanyInteraction_type_idx" ON "CompanyInteraction"("type");

-- AddForeignKey
ALTER TABLE "CompanyInteraction" ADD CONSTRAINT "CompanyInteraction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
