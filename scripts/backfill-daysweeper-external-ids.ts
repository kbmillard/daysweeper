#!/usr/bin/env npx tsx
/**
 * Assign stable GPT-style externalIds to Companies/Locations that are missing them,
 * so CRM export and future GPT deduping work. IDs persist in Postgres (required for stability).
 *
 * Format matches existing data: cmp_<12 hex>, loc_<12 hex>
 *
 * Run: npx tsx scripts/backfill-daysweeper-external-ids.ts
 *      npx tsx scripts/backfill-daysweeper-external-ids.ts --dry-run
 */

import { config } from 'dotenv';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const dryRun = process.argv.includes('--dry-run');

function genCmpId() {
  return `cmp_${randomBytes(6).toString('hex')}`;
}

function genLocId() {
  return `loc_${randomBytes(6).toString('hex')}`;
}

function mergeMeta(
  existing: unknown,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...base, ...patch };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const now = new Date().toISOString();

  try {
    const companiesNeedingId = await prisma.company.findMany({
      where: { externalId: null },
      select: { id: true, metadata: true }
    });

    const locationsNeedingId = await prisma.location.findMany({
      where: { externalId: null },
      select: { id: true, companyId: true, metadata: true }
    });

    console.log(
      `Companies without externalId: ${companiesNeedingId.length}\nLocations without externalId: ${locationsNeedingId.length}`
    );

    if (dryRun) {
      console.log('Dry run — no updates.');
      return;
    }

    const usedCompany = new Set(
      (
        await prisma.company.findMany({
          where: { externalId: { not: null } },
          select: { externalId: true }
        })
      )
        .map((r) => r.externalId)
        .filter(Boolean) as string[]
    );

    const usedLocation = new Set(
      (
        await prisma.location.findMany({
          where: { externalId: { not: null } },
          select: { externalId: true }
        })
      )
        .map((r) => r.externalId)
        .filter(Boolean) as string[]
    );

    function takeUniqueCompanyId(): string {
      for (let i = 0; i < 64; i++) {
        const id = genCmpId();
        if (!usedCompany.has(id)) {
          usedCompany.add(id);
          return id;
        }
      }
      throw new Error('Could not allocate unique company externalId');
    }

    function takeUniqueLocationId(): string {
      for (let i = 0; i < 64; i++) {
        const id = genLocId();
        if (!usedLocation.has(id)) {
          usedLocation.add(id);
          return id;
        }
      }
      throw new Error('Could not allocate unique location externalId');
    }

    let companiesUpdated = 0;
    for (const c of companiesNeedingId) {
      const externalId = takeUniqueCompanyId();
      await prisma.company.update({
        where: { id: c.id },
        data: {
          externalId,
          metadata: mergeMeta(c.metadata, {
            _backfillExternalIdAt: now,
            _daysweeperGeneratedExternalId: true
          }),
          updatedAt: new Date()
        }
      });
      companiesUpdated++;
    }

    const companyExternalByDbId = new Map(
      (
        await prisma.company.findMany({
          select: { id: true, externalId: true }
        })
      )
        .filter((r) => r.externalId)
        .map((r) => [r.id, r.externalId!] as const)
    );

    let locationsUpdated = 0;
    for (const loc of locationsNeedingId) {
      const coExt = companyExternalByDbId.get(loc.companyId);
      if (!coExt) {
        console.warn(
          `Skipping location ${loc.id}: company ${loc.companyId} missing externalId`
        );
        continue;
      }

      const externalId = takeUniqueLocationId();
      await prisma.location.update({
        where: { id: loc.id },
        data: {
          externalId,
          metadata: mergeMeta(loc.metadata, {
            _backfillExternalIdAt: now,
            _daysweeperGeneratedExternalId: true
          }),
          updatedAt: new Date()
        }
      });
      locationsUpdated++;
    }

    console.log(
      `Done. Companies backfilled: ${companiesUpdated}, locations backfilled: ${locationsUpdated}`
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
