#!/usr/bin/env npx tsx
/**
 * Reconstruct ChatGPT / CRM master supplier JSON from the database.
 * Includes rows imported via crm_import_v1 (POST /api/crm/import), crm_hierarchy_v6,
 * and crm_hierarchy_geocoded — same externalId / dedupe scheme.
 *
 * Run:
 *   npx tsx scripts/export-crm-master-json.ts [--out path]
 *
 * Flags:
 *   --all-external-ids   Ignore metadata._importSource; export every Location with
 *                        externalId whose Company has externalId (plus orphan companies
 *                        with externalId and no locations). Use if GPT uploads lost metadata.
 */

import { config } from 'dotenv';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const CRM_JSON_IMPORT_SOURCES = [
  'crm_import_v1',
  'crm_hierarchy_v6',
  'crm_hierarchy_geocoded'
] as const;

function importSourceFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const v = (metadata as Record<string, unknown>)._importSource;
  return typeof v === 'string' ? v : null;
}

function isCrmJsonImport(metadata: unknown): boolean {
  const s = importSourceFromMetadata(metadata);
  return s != null && (CRM_JSON_IMPORT_SOURCES as readonly string[]).includes(s);
}

/** Prefer GPT field externalParentId; fall back to linked parent's externalId (UI parent assignment). */
function resolveParentForExport(
  co: {
    externalParentId: string | null;
    Company: { name: string; externalId: string | null } | null;
  },
  parentNameByExternalId: Map<string, string>
): { parentCompanyId: string | null; parentCompany: string | null } {
  const linked = co.Company;
  const parentCompanyId = co.externalParentId ?? linked?.externalId ?? null;
  const parentCompany =
    (parentCompanyId ? parentNameByExternalId.get(parentCompanyId) : undefined) ??
    linked?.name ??
    null;
  return { parentCompanyId, parentCompany };
}

export type CrmMasterSupplierRecord = {
  companyId: string;
  locationId: string | null;
  parentCompanyId: string | null;
  companyKey: string | null;
  company: string;
  parentCompany: string | null;
  website: string | null;
  addressRaw: string | null;
  addressComponents: unknown | null;
};

async function main() {
  const outIdx = process.argv.indexOf('--out');
  const allExternalIds = process.argv.includes('--all-external-ids');
  const outPath =
    outIdx >= 0 && process.argv[outIdx + 1]
      ? process.argv[outIdx + 1]
      : join(
          process.cwd(),
          'exports',
          allExternalIds
            ? `chatgpt-crm-master-all-external-${new Date().toISOString().slice(0, 10)}.json`
            : `chatgpt-crm-master-${new Date().toISOString().slice(0, 10)}.json`
        );

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required (.env.local or .env)');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const [totalLocations, locationsWithExternalId, companiesWithExternalId] =
      await Promise.all([
        prisma.location.count(),
        prisma.location.count({ where: { externalId: { not: null } } }),
        prisma.company.count({ where: { externalId: { not: null } } })
      ]);

    const [locations, companies, parentRows] = await Promise.all([
      prisma.location.findMany({
        where: { externalId: { not: null } },
        include: {
          Company: {
            include: {
              // Parent company (Prisma field name on Company is `Company` for parentCompanyDbId)
              Company: { select: { name: true, externalId: true } }
            }
          }
        }
      }),
      prisma.company.findMany({
        where: { externalId: { not: null } },
        include: {
          Location: { select: { id: true } },
          Company: { select: { name: true, externalId: true } }
        }
      }),
      prisma.company.findMany({
        where: { externalId: { not: null } },
        select: { externalId: true, name: true }
      })
    ]);

    const parentNameByExternalId = new Map<string, string>();
    for (const row of parentRows) {
      if (row.externalId) parentNameByExternalId.set(row.externalId, row.name);
    }

    const records: CrmMasterSupplierRecord[] = [];

    const includeLocationRow = (loc: (typeof locations)[0]) => {
      if (allExternalIds) return true;
      return isCrmJsonImport(loc.metadata);
    };

    const includeOrphanCompany = (co: (typeof companies)[0]) => {
      if (allExternalIds) return true;
      return isCrmJsonImport(co.metadata);
    };

    for (const loc of locations) {
      if (!includeLocationRow(loc)) continue;
      const co = loc.Company;
      if (!co.externalId) continue;

      const { parentCompanyId, parentCompany } = resolveParentForExport(
        co,
        parentNameByExternalId
      );
      records.push({
        companyId: co.externalId,
        locationId: loc.externalId,
        parentCompanyId,
        companyKey: co.companyKey ?? null,
        company: co.name,
        parentCompany,
        website: co.website ?? null,
        addressRaw: loc.addressRaw,
        addressComponents: loc.addressComponents ?? null
      });
    }

    for (const co of companies) {
      if (!includeOrphanCompany(co)) continue;
      if (co.Location.length > 0) continue;
      if (!co.externalId) continue;

      const { parentCompanyId, parentCompany } = resolveParentForExport(
        co,
        parentNameByExternalId
      );
      records.push({
        companyId: co.externalId,
        locationId: null,
        parentCompanyId,
        companyKey: co.companyKey ?? null,
        company: co.name,
        parentCompany,
        website: co.website ?? null,
        addressRaw: null,
        addressComponents: null
      });
    }

    records.sort((a, b) => {
      const c = a.companyId.localeCompare(b.companyId);
      if (c !== 0) return c;
      const la = a.locationId ?? '\uFFFF';
      const lb = b.locationId ?? '\uFFFF';
      return la.localeCompare(lb);
    });

    const payload = {
      exportedAt: new Date().toISOString(),
      mode: allExternalIds ? 'all_external_ids' : 'crm_json_metadata',
      importSourcesIncluded: allExternalIds ? null : [...CRM_JSON_IMPORT_SOURCES],
      description: allExternalIds
        ? 'Every Location with externalId whose Company has externalId, plus Companies with externalId and no locations. Does not filter by metadata._importSource. Run pnpm run backfill:external-ids first if you added locations in the UI without externalId.'
        : 'Reconstructed from DB: Location/Company rows with metadata._importSource in importSourcesIncluded. companyId/locationId match GPT + POST /api/crm/import.',
      stats: {
        totalLocationRowsInDb: totalLocations,
        locationsWithExternalIdInDb: locationsWithExternalId,
        companiesWithExternalIdInDb: companiesWithExternalId,
        supplierRowsInThisFile: records.length,
        locationsMissingFromExport:
          totalLocations - locationsWithExternalId
      },
      recordCount: records.length,
      suppliers: records
    };

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Wrote ${records.length} records to ${outPath}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
