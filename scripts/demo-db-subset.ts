/**
 * Client demo DB: export a curated CRM subgraph from a source Postgres, import into a demo DB.
 *
 * Usage:
 *   SOURCE_DATABASE_URL=... tsx scripts/demo-db-subset.ts export --companies id1,id2 --out demo.json
 *   DEMO_DATABASE_URL=... tsx scripts/demo-db-subset.ts import --in demo.json --reset-crm --truncate-map-pins --confirm
 *
 * See docs/DEMO_ENVIRONMENT.md
 */
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { config } from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config({ path: join(process.cwd(), '.env.demo') });
config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

type SnapshotV1 = {
  version: 1;
  exportedAt: string;
  seedCompanyIds: string[];
  expandedCompanyIds: string[];
  companies: Prisma.CompanyUncheckedCreateInput[];
  locations: Prisma.LocationUncheckedCreateInput[];
  customers: Prisma.CustomerUncheckedCreateInput[];
  companyInteractions: Prisma.CompanyInteractionUncheckedCreateInput[];
  mapPins: Prisma.MapPinUncheckedCreateInput[];
};

function usage(): void {
  console.log(`
demo-db-subset — export/import curated Company/Location CRM data for a client demo.

Commands:
  export   --companies id1,id2,... [--out path] [--map-pins-deg N]
           Reads SOURCE_DATABASE_URL (or DATABASE_URL). Expands company IDs to include
           parents and descendants so foreign keys stay valid. Optional: copy MapPin rows
           within ±N degrees of any exported location (crude box; default: skip map pins).

  import   --in path.json --reset-crm [--truncate-map-pins] --confirm
           Writes to DEMO_DATABASE_URL only. --confirm required literal: I_UNDERSTAND_RESET
           --reset-crm runs TRUNCATE "Company" CASCADE (wipes all CRM companies/locations/etc.)

  verify   Prints row counts from DEMO_DATABASE_URL (or DATABASE_URL if DEMO unset).

Environment:
  SOURCE_DATABASE_URL   Source Postgres for export (falls back to DATABASE_URL)
  DEMO_DATABASE_URL     Target Postgres for import/verify
`);
}

function makeClient(url: string): { prisma: PrismaClient; pool: Pool } {
  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { prisma, pool };
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--confirm') {
      const v = argv[i + 1];
      if (v && !v.startsWith('--')) {
        out.confirm = v;
        i++;
      }
    } else if (a.startsWith('--')) {
      const key = a.slice(2);
      const v = argv[i + 1];
      if (v && !v.startsWith('--')) {
        out[key] = v;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

async function expandCompanyClosure(prisma: PrismaClient, seedIds: string[]): Promise<string[]> {
  const set = new Set(seedIds.filter(Boolean));
  if (set.size === 0) return [];
  let changed = true;
  while (changed) {
    changed = false;
    const ids = [...set];
    const rows = await prisma.company.findMany({
      where: { id: { in: ids } },
      select: { id: true, parentCompanyDbId: true }
    });
    for (const r of rows) {
      const p = r.parentCompanyDbId;
      if (p && !set.has(p)) {
        set.add(p);
        changed = true;
      }
    }
    const children = await prisma.company.findMany({
      where: { parentCompanyDbId: { in: ids } },
      select: { id: true }
    });
    for (const c of children) {
      if (!set.has(c.id)) {
        set.add(c.id);
        changed = true;
      }
    }
  }
  return [...set];
}

function topoCompanyOrder(
  companies: Prisma.CompanyUncheckedCreateInput[]
): Prisma.CompanyUncheckedCreateInput[] {
  const byId = new Map(companies.map((c) => [c.id, c]));
  const visiting = new Set<string>();
  const done = new Set<string>();
  const ordered: Prisma.CompanyUncheckedCreateInput[] = [];
  function visit(id: string): void {
    if (done.has(id)) return;
    if (visiting.has(id)) throw new Error(`Company hierarchy cycle involving ${id}`);
    visiting.add(id);
    const row = byId.get(id);
    const p = row?.parentCompanyDbId;
    if (p && typeof p === 'string' && byId.has(p)) visit(p);
    visiting.delete(id);
    done.add(id);
    if (row) ordered.push(row);
  }
  for (const c of companies) visit(c.id);
  return ordered;
}

function parseCompanyIds(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function exportSnapshot(): Promise<void> {
  const args = parseArgs(process.argv);
  const companiesArg = args.companies;
  if (typeof companiesArg !== 'string' || !companiesArg.trim()) {
    console.error('export requires --companies id1,id2,...');
    process.exit(1);
  }
  const seedIds = parseCompanyIds(companiesArg);
  if (seedIds.length === 0) {
    console.error('export: no company ids after parsing --companies');
    process.exit(1);
  }
  const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
  if (!sourceUrl) {
    console.error('Set SOURCE_DATABASE_URL or DATABASE_URL for export.');
    process.exit(1);
  }
  const mapPinsDeg =
    typeof args['map-pins-deg'] === 'string' ? Number(args['map-pins-deg']) : NaN;
  const includeMapPins = Number.isFinite(mapPinsDeg) && mapPinsDeg > 0;

  const { prisma, pool } = makeClient(sourceUrl);
  try {
    const expanded = await expandCompanyClosure(prisma, seedIds);
    const companies = await prisma.company.findMany({
      where: { id: { in: expanded } }
    });
    const locations = await prisma.location.findMany({
      where: { companyId: { in: expanded } },
      select: {
        id: true,
        externalId: true,
        companyId: true,
        addressRaw: true,
        addressNormalized: true,
        addressComponents: true,
        addressConfidence: true,
        latitude: true,
        longitude: true,
        legacyJson: true,
        metadata: true,
        locationName: true,
        phone: true,
        email: true,
        website: true,
        createdAt: true,
        updatedAt: true
      }
    });
    const customers = await prisma.customer.findMany({
      where: { companyId: { in: expanded } }
    });
    const companyInteractions = await prisma.companyInteraction.findMany({
      where: { companyId: { in: expanded } }
    });

    let mapPins: Prisma.MapPinUncheckedCreateInput[] = [];
    if (includeMapPins) {
      const locsWithCoords = locations.filter(
        (l) => l.latitude != null && l.longitude != null
      );
      const allPins = await prisma.mapPin.findMany({
        where: { hidden: false }
      });
      const pad = mapPinsDeg;
      for (const pin of allPins) {
        const plat = Number(pin.latitude);
        const plng = Number(pin.longitude);
        if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
        for (const l of locsWithCoords) {
          const la = Number(l.latitude);
          const lo = Number(l.longitude);
          if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
          if (Math.abs(plat - la) <= pad && Math.abs(plng - lo) <= pad) {
            mapPins.push({
              id: pin.id,
              latitude: pin.latitude,
              longitude: pin.longitude,
              hidden: pin.hidden,
              createdAt: pin.createdAt
            });
            break;
          }
        }
      }
      const seen = new Set<string>();
      mapPins = mapPins.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
    }

    const snapshot: SnapshotV1 = {
      version: 1,
      exportedAt: new Date().toISOString(),
      seedCompanyIds: seedIds,
      expandedCompanyIds: expanded,
      companies,
      locations,
      customers,
      companyInteractions,
      mapPins
    };

    const json = JSON.stringify(snapshot, null, 2);
    const outPath = typeof args.out === 'string' ? args.out : '';
    if (outPath) {
      await writeFile(outPath, json, 'utf8');
      console.log(`Wrote ${outPath} (${companies.length} companies, ${locations.length} locations).`);
    } else {
      process.stdout.write(json);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

function reviveDates<T extends Record<string, unknown>>(row: T, dateKeys: (keyof T)[]): T {
  const o = { ...row };
  for (const k of dateKeys) {
    const v = o[k];
    if (typeof v === 'string') (o as Record<string, unknown>)[k as string] = new Date(v);
  }
  return o;
}

async function importSnapshot(): Promise<void> {
  const args = parseArgs(process.argv);
  const inPath = typeof args.in === 'string' ? args.in : '';
  if (!inPath) {
    console.error('import requires --in path.json');
    process.exit(1);
  }
  const resetCrm = args['reset-crm'] === true || args['reset-crm'] === 'true';
  if (!resetCrm) {
    console.error('import requires --reset-crm (refuses to merge into a dirty demo by default).');
    process.exit(1);
  }
  if (args.confirm !== 'I_UNDERSTAND_RESET') {
    console.error('import requires --confirm I_UNDERSTAND_RESET');
    process.exit(1);
  }
  const demoUrl = process.env.DEMO_DATABASE_URL;
  if (!demoUrl) {
    console.error('Set DEMO_DATABASE_URL for import (never use production URL here).');
    process.exit(1);
  }
  if (demoUrl === process.env.DATABASE_URL && !process.env.DEMO_ALLOW_IMPORT_TO_PRIMARY_DATABASE) {
    console.error(
      'Refusing import: DEMO_DATABASE_URL equals DATABASE_URL. Set DEMO_ALLOW_IMPORT_TO_PRIMARY_DATABASE=yes only if intentional.'
    );
    process.exit(1);
  }

  const raw = await readFile(inPath, 'utf8');
  const snap = JSON.parse(raw) as SnapshotV1;
  if (snap.version !== 1 || !Array.isArray(snap.companies)) {
    console.error('Invalid snapshot (expected version 1).');
    process.exit(1);
  }

  const truncateMapPins =
    args['truncate-map-pins'] === true || args['truncate-map-pins'] === 'true';

  const { prisma, pool } = makeClient(demoUrl);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`TRUNCATE TABLE "Company" CASCADE`);
      if (truncateMapPins) {
        await tx.$executeRawUnsafe(`TRUNCATE TABLE "MapPin"`);
        await tx.$executeRawUnsafe(`TRUNCATE TABLE "HiddenDot"`);
      }

      const companies = snap.companies.map((c) =>
        reviveDates({ ...c, primaryLocationId: null }, ['createdAt', 'updatedAt'])
      ) as Prisma.CompanyUncheckedCreateInput[];

      const ordered = topoCompanyOrder(companies);
      for (const c of ordered) {
        await tx.company.create({ data: c });
      }

      for (const loc of snap.locations) {
        const data = reviveDates({ ...loc }, ['createdAt', 'updatedAt']) as Prisma.LocationUncheckedCreateInput;
        await tx.location.create({ data });
      }

      for (const c of snap.companies) {
        if (c.primaryLocationId) {
          await tx.company.update({
            where: { id: c.id },
            data: { primaryLocationId: c.primaryLocationId }
          });
        }
      }

      for (const cu of snap.customers) {
        const data = reviveDates({ ...cu }, ['createdAt', 'updatedAt']) as Prisma.CustomerUncheckedCreateInput;
        await tx.customer.create({ data });
      }

      for (const ci of snap.companyInteractions) {
        const data = reviveDates(
          { ...ci },
          ['createdAt', 'updatedAt']
        ) as Prisma.CompanyInteractionUncheckedCreateInput;
        await tx.companyInteraction.create({ data });
      }

      for (const mp of snap.mapPins ?? []) {
        const data = reviveDates({ ...mp }, ['createdAt']) as Prisma.MapPinUncheckedCreateInput;
        await tx.mapPin.create({ data });
      }
    });

    console.log(
      `Import complete: ${snap.companies.length} companies, ${snap.locations.length} locations, ${snap.customers.length} customers, ${snap.companyInteractions.length} interactions, ${snap.mapPins?.length ?? 0} map pins.`
    );
    console.log(
      'Optional: run `node scripts/sync-shared-route-to-mappins.mjs` against the demo DB to rebuild LastLeg canonical route from MapPin rows.'
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function verify(): Promise<void> {
  const url = process.env.DEMO_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Set DEMO_DATABASE_URL (or DATABASE_URL) for verify.');
    process.exit(1);
  }
  const { prisma, pool } = makeClient(url);
  try {
    const [companies, locations, mapPins, customers] = await Promise.all([
      prisma.company.count(),
      prisma.location.count(),
      prisma.mapPin.count(),
      prisma.customer.count()
    ]);
    const sample = await prisma.company.findMany({
      take: 12,
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    });
    console.log('\n=== Demo / target DB snapshot ===');
    console.log(`Companies:  ${companies}`);
    console.log(`Locations:  ${locations}`);
    console.log(`Customers:  ${customers}`);
    console.log(`MapPins:    ${mapPins}`);
    console.log('\nSample companies (up to 12, name asc):');
    for (const c of sample) console.log(`  ${c.id}\t${c.name}`);
    console.log('');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (!cmd || cmd === '-h' || cmd === '--help') {
    usage();
    process.exit(0);
  }
  if (cmd === 'export') await exportSnapshot();
  else if (cmd === 'import') await importSnapshot();
  else if (cmd === 'verify') await verify();
  else {
    console.error(`Unknown command: ${cmd}`);
    usage();
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
