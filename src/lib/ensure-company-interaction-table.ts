import { prisma } from '@/lib/prisma';

/**
 * Idempotent: create CompanyInteraction table and indexes if they don't exist.
 * Use when migrations haven't run (e.g. Vercel deploy) but we need the table.
 */
export async function ensureCompanyInteractionTable(): Promise<boolean> {
  try {
    // Table with IF NOT EXISTS; updatedAt has default so raw inserts work
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CompanyInteraction" (
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
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CompanyInteraction_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CompanyInteraction_createdAt_idx" ON "CompanyInteraction"("createdAt");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CompanyInteraction_companyId_idx" ON "CompanyInteraction"("companyId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CompanyInteraction_userId_idx" ON "CompanyInteraction"("userId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CompanyInteraction_orgId_idx" ON "CompanyInteraction"("orgId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CompanyInteraction_type_idx" ON "CompanyInteraction"("type");
    `);
    // FK only if constraint doesn't exist
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CompanyInteraction_companyId_fkey'
        ) THEN
          ALTER TABLE "CompanyInteraction"
          ADD CONSTRAINT "CompanyInteraction_companyId_fkey"
          FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    return true;
  } catch (e) {
    console.error('ensureCompanyInteractionTable failed:', e);
    return false;
  }
}
