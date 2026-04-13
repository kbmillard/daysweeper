/**
 * Remove duplicate companies/locations created by the corridor GPT batch (Apr 2026).
 * Keeps canonical master rows (Brose cmp_2865209ebec9, DENSO cmp_f272c2595573, TG cmp_b449e318fbe0).
 * Does NOT touch Gestamp (any company with companyKey gestamp.com or name-only Gestamp rollup).
 *
 *   npx tsx scripts/repair-crm-corridor-duplicates.ts
 */

import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config({ path: join(process.cwd(), '.env.vercel') });
config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const ORPHAN_COMPANY_EXTERNAL_IDS = [
  'cmp_726d2a91fc38', // Brose Spartanburg rollup (dup of Duncan on master Brose)
  'cmp_72f4d3b65a20', // DENSO rollup (dups Maryville + Athens)
  'cmp_721a4e37bd5f' // Toyoda Gosei rollup (dups KY + MO reassigned)
] as const;

/** Location externalIds to delete (duplicate addresses vs canonical master). */
const LOCATION_EXTERNAL_IDS_TO_DELETE = [
  'loc_72ab971cc54e', // Duncan SC dup of loc_f8cdc5e39aa4
  'loc_72d0f1b86d2e', // Maryville dup of loc_24a935fd1484
  'loc_72f81e3c9a67', // Athens dup of loc_9eff4e6c531d
  'loc_72ae6c91f7d4', // Lebanon KY dup of loc_0f7bee3eb9e7
  'loc_72c65a204db9' // Hopkinsville dup of loc_8f31c6d454ce
] as const;

const MISSOURI_LOCATION_EXTERNAL_ID = 'loc_7298da37fb04';
const TG_KENTUCKY_MASTER_EXTERNAL_ID = 'cmp_b449e318fbe0';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const gestampCount = await prisma.company.count({
    where: { companyKey: 'gestamp.com' }
  });
  console.log(`Gestamp companies (gestamp.com key) in DB: ${gestampCount} — leaving all untouched.`);

  const tgKentucky = await prisma.company.findUnique({
    where: { externalId: TG_KENTUCKY_MASTER_EXTERNAL_ID },
    select: { id: true, name: true }
  });
  if (!tgKentucky) {
    console.error('Missing canonical TG Kentucky company', TG_KENTUCKY_MASTER_EXTERNAL_ID);
    process.exit(1);
  }

  await prisma.$transaction(async (tx) => {
    const mo = await tx.location.update({
      where: { externalId: MISSOURI_LOCATION_EXTERNAL_ID },
      data: { companyId: tgKentucky.id, updatedAt: new Date() },
      select: { id: true, addressRaw: true }
    });
    console.log('Reassigned Missouri location to TG Kentucky, LLC:', mo);

    for (const extId of LOCATION_EXTERNAL_IDS_TO_DELETE) {
      const del = await tx.location.deleteMany({ where: { externalId: extId } });
      console.log(`Deleted locations with externalId ${extId}: count=${del.count}`);
    }

    for (const extId of ORPHAN_COMPANY_EXTERNAL_IDS) {
      const left = await tx.location.count({
        where: { Company: { externalId: extId } }
      });
      if (left > 0) {
        throw new Error(`Company ${extId} still has ${left} locations; abort`);
      }
      const del = await tx.company.deleteMany({ where: { externalId: extId } });
      console.log(`Deleted company ${extId}: count=${del.count}`);
    }
  });

  console.log('\nRepair complete.');
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
