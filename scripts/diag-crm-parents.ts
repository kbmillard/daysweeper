/**
 * One-off: audit parent links + orphan cmp_* companies (corridor / GPT ids).
 *   npx tsx scripts/diag-crm-parents.ts
 */

import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config({ path: join(process.cwd(), '.env.vercel') });
config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const GESTAMP_EXTERNAL = 'cmp_72b1f8476a13';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const corridorChatGptIds = [
    'cmp_726d2a91fc38',
    'cmp_72f4d3b65a20',
    'cmp_721a4e37bd5f'
  ];

  const orphans = await prisma.company.findMany({
    where: {
      externalId: { in: corridorChatGptIds }
    },
    select: {
      id: true,
      externalId: true,
      name: true,
      companyKey: true,
      externalParentId: true,
      parentCompanyDbId: true,
      Company: { select: { externalId: true, name: true } },
      _count: { select: { Location: true } }
    }
  });

  console.log('--- Orphan GPT corridor companies (should be 0 locations if remap worked) ---');
  console.log(JSON.stringify(orphans, (_k, v) => (v === undefined ? undefined : v), 2));

  const masterKeys = ['brose.com', 'denso.com', 'toyodagosei.com', 'toyoda-gosei.com', 'gestamp.com'];
  const byKey = await prisma.company.findMany({
    where: { companyKey: { in: masterKeys } },
    select: {
      externalId: true,
      name: true,
      companyKey: true,
      externalParentId: true,
      parentCompanyDbId: true,
      Company: { select: { externalId: true, name: true } },
      _count: { select: { Location: true } }
    },
    orderBy: [{ companyKey: 'asc' }, { name: 'asc' }]
  });

  console.log('\n--- Companies by known corridor companyKeys ---');
  for (const c of byKey) {
    const p = c.Company
      ? `${c.Company.name} (${c.Company.externalId ?? 'no ext'})`
      : '(no parent link)';
    console.log(
      `${c.name} | ext=${c.externalId} | key=${c.companyKey} | locs=${c._count.Location} | extParent=${c.externalParentId} | parentDb=${c.parentCompanyDbId ? 'yes' : 'no'} → ${p}`
    );
  }

  const gestamp = await prisma.company.findMany({
    where: { OR: [{ externalId: GESTAMP_EXTERNAL }, { companyKey: 'gestamp.com' }] },
    select: {
      externalId: true,
      name: true,
      companyKey: true,
      externalParentId: true,
      parentCompanyDbId: true,
      Company: { select: { externalId: true, name: true } },
      _count: { select: { Location: true } }
    }
  });
  console.log('\n--- Gestamp (do not modify) ---');
  console.log(JSON.stringify(gestamp, null, 2));

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
