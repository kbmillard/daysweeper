/**
 * Removes companies/locations from import-crm-tier2-3-suppliers-batch.ts only.
 *
 *   npx tsx scripts/undo-import-tier2-3-suppliers-batch.ts
 */

import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config({ path: join(process.cwd(), '.env.vercel') });
config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const COMPANY_EXTERNAL_IDS = [
  'cmp_72bht9e41a2d',
  'cmp_72csp51a0b77',
  'cmp_72lex57fa21c',
  'cmp_72mmm4a11f86',
  'cmp_72elite3f0b6a',
  'cmp_72mar1d04bc5'
] as const;

const LOCATION_EXTERNAL_IDS = [
  'loc_72bhtb8f1031',
  'loc_72bhtd2a94c8',
  'loc_72cspfa61d24',
  'loc_72lex1ab7d64',
  'loc_72mmm9bf4a21',
  'loc_72elite81da43',
  'loc_72mar7e9f2d0'
] as const;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const batchCompanies = await prisma.company.findMany({
    where: { externalId: { in: [...COMPANY_EXTERNAL_IDS] } },
    select: { id: true, externalId: true, name: true }
  });

  const locRows = await prisma.location.findMany({
    where: { externalId: { in: [...LOCATION_EXTERNAL_IDS] } },
    select: { id: true, externalId: true }
  });

  if (batchCompanies.length === 0 && locRows.length === 0) {
    console.log('Nothing to remove (no matching company or location externalIds).');
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  const companyIds = batchCompanies.map((c) => c.id);
  const locationIds = locRows.map((l) => l.id);

  await prisma.$transaction(async (tx) => {
    if (companyIds.length) {
      await tx.company.updateMany({
        where: { parentCompanyDbId: { in: companyIds } },
        data: { parentCompanyDbId: null }
      });
      await tx.customer.updateMany({
        where: { companyId: { in: companyIds } },
        data: { companyId: null }
      });
    }

    if (locationIds.length) {
      await tx.company.updateMany({
        where: { primaryLocationId: { in: locationIds } },
        data: { primaryLocationId: null }
      });
    }

    const delLoc = await tx.location.deleteMany({
      where: { externalId: { in: [...LOCATION_EXTERNAL_IDS] } }
    });
    console.log(`Locations deleted: ${delLoc.count}`);

    const delCo = await tx.company.deleteMany({
      where: { externalId: { in: [...COMPANY_EXTERNAL_IDS] } }
    });
    console.log(`Companies deleted: ${delCo.count}`);
    if (batchCompanies.length) {
      console.log(
        batchCompanies.map((c) => `  - ${c.name} (${c.externalId})`).join('\n')
      );
    }
  });

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
