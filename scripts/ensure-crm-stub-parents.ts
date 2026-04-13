/**
 * Create placeholder Company rows for externalParentId values that appear in master JSON
 * but were never imported as companies, then set parentCompanyDbId on US subsidiaries.
 *
 *   npx tsx scripts/ensure-crm-stub-parents.ts
 */

import { config } from 'dotenv';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config({ path: join(process.cwd(), '.env.vercel') });
config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const now = new Date();

  const toyodaJapan = await prisma.company.upsert({
    where: { externalId: 'cmp_ceb1ecd3e4d3' },
    create: {
      id: randomUUID(),
      externalId: 'cmp_ceb1ecd3e4d3',
      name: 'Toyoda Gosei Co., Ltd.',
      metadata: {
        _stubParent: true,
        _note: 'Placeholder for master JSON parentCompanyId; no US locations on this row.'
      },
      createdAt: now,
      updatedAt: now
    },
    update: { updatedAt: now }
  });

  const densoCorp = await prisma.company.upsert({
    where: { externalId: 'cmp:name:denso-corporation' },
    create: {
      id: randomUUID(),
      externalId: 'cmp:name:denso-corporation',
      name: 'DENSO CORPORATION',
      metadata: {
        _stubParent: true,
        _note: 'Placeholder for master JSON externalParentId cmp:name:denso-corporation'
      },
      createdAt: now,
      updatedAt: now
    },
    update: { updatedAt: now }
  });

  const tgKy = await prisma.company.update({
    where: { externalId: 'cmp_b449e318fbe0' },
    data: {
      parentCompanyDbId: toyodaJapan.id,
      updatedAt: now
    },
    select: { name: true, externalId: true }
  });

  const densoUs = await prisma.company.update({
    where: { externalId: 'cmp_f272c2595573' },
    data: {
      parentCompanyDbId: densoCorp.id,
      updatedAt: now
    },
    select: { name: true, externalId: true }
  });

  console.log('Linked:', {
    tgKentucky: tgKy,
    parentToyoda: toyodaJapan.externalId,
    densoInternational: densoUs,
    parentDenso: densoCorp.externalId
  });

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
