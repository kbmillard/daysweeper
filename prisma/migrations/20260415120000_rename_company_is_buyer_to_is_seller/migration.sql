-- Rename competitor/vendor-research flag (grey map layer) to seller terminology.
DROP INDEX IF EXISTS "Company_isBuyer_idx";
ALTER TABLE "Company" RENAME COLUMN "isBuyer" TO "isSeller";
CREATE INDEX "Company_isSeller_idx" ON "Company"("isSeller");
