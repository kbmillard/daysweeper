#!/usr/bin/env npx tsx
/**
 * One-time / temporary: reduce CRM + map to **one buyer company + one geocoded location**
 * per corridor state (Michigan → South Carolina), remove all other companies (including sellers),
 * clear MapPin / HiddenDot (container dots), and wipe Targets + Routes (LastLeg dots / planner).
 *
 * Does **not** touch WarehouseItem (bins), ScrapedCompany, UserPreference, MetaKV, GeocodeCache.
 *
 * Usage:
 *   pnpm exec tsx scripts/slim-corridor-states-demo.ts              # dry-run (default)
 *   pnpm exec tsx scripts/slim-corridor-states-demo.ts --apply --confirm I_UNDERSTAND_CORRIDOR_SLIM
 *
 * Optional:
 *   --org-id <clerk_org_id>   Only consider/delete non-keeper companies with this orgId (use unscoped run to wipe all orgs).
 *
 * Before running on anything you care about, export a snapshot:
 *   pnpm run demo:export -- --companies "<id1>,<id2>" --out exports/backup.json
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { config } from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const CONFIRM = 'I_UNDERSTAND_CORRIDOR_SLIM';

/** Southward corridor: MI through SC (inclusive). */
const CORRIDOR_STATES = [
  'MI',
  'IN',
  'OH',
  'KY',
  'WV',
  'VA',
  'TN',
  'NC',
  'SC'
] as const;

type CorridorState = (typeof CORRIDOR_STATES)[number];

const STATE_NAME_TO_CODE: Record<string, string> = {
  michigan: 'MI',
  indiana: 'IN',
  ohio: 'OH',
  kentucky: 'KY',
  'west virginia': 'WV',
  virginia: 'VA',
  tennessee: 'TN',
  'north carolina': 'NC',
  'south carolina': 'SC'
};

/** Curated fallbacks: real addresses + coordinates (WGS84) for full Daysweeper flows. */
const SEED_ROWS: Record<
  CorridorState,
  {
    companyName: string;
    addressRaw: string;
    addressNormalized: string;
    lat: string;
    lng: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    phone: string;
    email: string;
    website: string;
    locationName: string;
    companyStatus: string;
    productType: string;
    locationMeta: Record<string, unknown>;
    companyMeta: Record<string, unknown>;
  }
> = {
  MI: {
    companyName: 'Demo — Michigan (Ford Rouge complex area)',
    addressRaw: '1 American Rd, Dearborn, MI 48126, USA',
    addressNormalized: '1 American Rd, Dearborn, MI 48126, US',
    lat: '42.3223',
    lng: '-83.1763',
    city: 'Dearborn',
    state: 'MI',
    postal_code: '48126',
    country: 'US',
    phone: '+1 313-845-8696',
    email: 'demo-mi@example.invalid',
    website: 'https://www.ford.com',
    locationName: 'Dearborn manufacturing / HQ vicinity',
    companyStatus: 'Contacted - meeting set',
    productType: 'Automotive OEM / stamping',
    locationMeta: {
      status: 'Account',
      productType: 'Automotive OEM / stamping'
    },
    companyMeta: {
      productType: 'Automotive OEM / stamping',
      profile: {
        summary:
          'Demo row for Michigan: use address edit, geocode hints, map pin, location contact, CRM status, product type, interactions, and child/parent flows elsewhere.'
      }
    }
  },
  IN: {
    companyName: 'Demo — Indiana (Columbus industrial corridor)',
    addressRaw: '500 Jackson St, Columbus, IN 47201, USA',
    addressNormalized: '500 Jackson St, Columbus, IN 47201, US',
    lat: '39.2090',
    lng: '-85.9214',
    city: 'Columbus',
    state: 'IN',
    postal_code: '47201',
    country: 'US',
    phone: '+1 812-372-5000',
    email: 'demo-in@example.invalid',
    website: 'https://www.cummins.com',
    locationName: 'Columbus engine corridor (demo)',
    companyStatus: 'Account',
    productType: 'Engines / powertrain',
    locationMeta: { status: 'Account', productType: 'Engines / powertrain' },
    companyMeta: {
      productType: 'Engines / powertrain',
      profile: { summary: 'Indiana demo: coordinates on I-65 corridor; use route planner + map layers.' }
    }
  },
  OH: {
    companyName: 'Demo — Ohio (Marysville auto assembly area)',
    addressRaw: '24000 Honda Pkwy, Marysville, OH 43040, USA',
    addressNormalized: '24000 Honda Pkwy, Marysville, OH 43040, US',
    lat: '40.2344',
    lng: '-83.3656',
    city: 'Marysville',
    state: 'OH',
    postal_code: '43040',
    country: 'US',
    phone: '+1 937-644-5000',
    email: 'demo-oh@example.invalid',
    website: 'https://www.honda.com',
    locationName: 'Marysville assembly (demo)',
    companyStatus: 'Contacted - no answer',
    productType: 'Automotive assembly',
    locationMeta: { status: 'Contacted - no answer', productType: 'Automotive assembly' },
    companyMeta: {
      productType: 'Automotive assembly',
      profile: { summary: 'Ohio demo: strong address + lat/lng for Earth / Regrid links and HQ-style status on company row.' }
    }
  },
  KY: {
    companyName: 'Demo — Kentucky (Georgetown Toyota plant area)',
    addressRaw: '1001 Cherry Blossom Way, Georgetown, KY 40324, USA',
    addressNormalized: '1001 Cherry Blossom Way, Georgetown, KY 40324, US',
    lat: '38.2147',
    lng: '-84.5986',
    city: 'Georgetown',
    state: 'KY',
    postal_code: '40324',
    country: 'US',
    phone: '+1 502-868-5000',
    email: 'demo-ky@example.invalid',
    website: 'https://www.toyota.com',
    locationName: 'Georgetown manufacturing (demo)',
    companyStatus: 'Account',
    productType: 'Automotive assembly',
    locationMeta: { status: 'Account', productType: 'Automotive assembly' },
    companyMeta: {
      productType: 'Automotive assembly',
      profile: { summary: 'Kentucky demo: use LastLeg add-to-route after you re-import targets; CRM lanes map to pin colors.' }
    }
  },
  WV: {
    companyName: 'Demo — West Virginia (Huntington / Ohio River industry)',
    addressRaw: '1 John Marshall Dr, Huntington, WV 25703, USA',
    addressNormalized: '1 John Marshall Dr, Huntington, WV 25703, US',
    lat: '38.4249',
    lng: '-82.4327',
    city: 'Huntington',
    state: 'WV',
    postal_code: '25703',
    country: 'US',
    phone: '+1 304-696-3170',
    email: 'demo-wv@example.invalid',
    website: 'https://www.marshall.edu',
    locationName: 'Huntington river city (demo)',
    companyStatus: 'Contacted - meeting set',
    productType: 'Research / education anchor address',
    locationMeta: {
      status: 'Contacted - meeting set',
      productType: 'Research / education anchor address'
    },
    companyMeta: {
      productType: 'Research / education anchor address',
      profile: {
        summary:
          'West Virginia demo: stable civic address for geocode; swap to a supplier row later if you import CRM JSON.'
      }
    }
  },
  VA: {
    companyName: 'Demo — Virginia (Newport News port / shipyard area)',
    addressRaw: '410 Washington Ave, Newport News, VA 23604, USA',
    addressNormalized: '410 Washington Ave, Newport News, VA 23604, US',
    lat: '36.9771',
    lng: '-76.4269',
    city: 'Newport News',
    state: 'VA',
    postal_code: '23604',
    country: 'US',
    phone: '+1 757-380-8800',
    email: 'demo-va@example.invalid',
    website: 'https://www.huntingtoningalls.com',
    locationName: 'Coastal VA industrial (demo)',
    companyStatus: 'Contacted - not interested',
    productType: 'Shipbuilding / defense industrial',
    locationMeta: {
      status: 'Contacted - not interested',
      productType: 'Shipbuilding / defense industrial'
    },
    companyMeta: {
      productType: 'Shipbuilding / defense industrial',
      profile: { summary: 'Virginia demo: tests “not interested” pipeline + dark pin styling on the map.' }
    }
  },
  TN: {
    companyName: 'Demo — Tennessee (Smyrna Nissan plant area)',
    addressRaw: '983 Nissan Dr, Smyrna, TN 37167, USA',
    addressNormalized: '983 Nissan Dr, Smyrna, TN 37167, US',
    lat: '35.9911',
    lng: '-86.4536',
    city: 'Smyrna',
    state: 'TN',
    postal_code: '37167',
    country: 'US',
    phone: '+1 615-459-1444',
    email: 'demo-tn@example.invalid',
    website: 'https://www.nissanusa.com',
    locationName: 'Smyrna assembly (demo)',
    companyStatus: 'Account',
    productType: 'Automotive assembly',
    locationMeta: { status: 'Account', productType: 'Automotive assembly' },
    companyMeta: {
      productType: 'Automotive assembly',
      profile: { summary: 'Tennessee demo: I-24 / Nashville logistics belt; good for corridor route experiments.' }
    }
  },
  NC: {
    companyName: 'Demo — North Carolina (Charlotte industrial)',
    addressRaw: '9801 Statesville Rd, Charlotte, NC 28269, USA',
    addressNormalized: '9801 Statesville Rd, Charlotte, NC 28269, US',
    lat: '35.3206',
    lng: '-80.8061',
    city: 'Charlotte',
    state: 'NC',
    postal_code: '28269',
    country: 'US',
    phone: '+1 704-971-4000',
    email: 'demo-nc@example.invalid',
    website: 'https://www.honeywell.com',
    locationName: 'Charlotte metro facility (demo)',
    companyStatus: 'Contacted - no answer',
    productType: 'Industrial / automation',
    locationMeta: { status: 'Contacted - no answer', productType: 'Industrial / automation' },
    companyMeta: {
      productType: 'Industrial / automation',
      profile: { summary: 'North Carolina demo: Piedmont crescent; use bins + map without clutter.' }
    }
  },
  SC: {
    companyName: 'Demo — South Carolina (North Charleston aerospace)',
    addressRaw: '3455 Air Frame Dr, North Charleston, SC 29418, USA',
    addressNormalized: '3455 Air Frame Dr, North Charleston, SC 29418, US',
    lat: '32.8980',
    lng: '-80.0405',
    city: 'North Charleston',
    state: 'SC',
    postal_code: '29418',
    country: 'US',
    phone: '+1 843-965-3411',
    email: 'demo-sc@example.invalid',
    website: 'https://www.boeing.com',
    locationName: 'CHS assembly / delivery center area (demo)',
    companyStatus: 'Account',
    productType: 'Aerospace assembly',
    locationMeta: { status: 'Account', productType: 'Aerospace assembly' },
    companyMeta: {
      productType: 'Aerospace assembly',
      profile: { summary: 'South Carolina demo: coastal port + aerospace cluster; end of MI→SC corridor set.' }
    }
  }
};

const SLIM_COMPANY_PREFIX = 'slim-corridor-';

function parseArgs(argv: string[]): {
  apply: boolean;
  confirm: string | undefined;
  orgId: string | undefined;
} {
  let apply = false;
  let confirm: string | undefined;
  let orgId: string | undefined;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') apply = true;
    else if (a === '--confirm') {
      confirm = argv[i + 1];
      i++;
    } else if (a.startsWith('--org-id=')) orgId = a.split('=')[1];
    else if (a === '--org-id') {
      orgId = argv[i + 1];
      i++;
    }
  }
  return { apply, confirm, orgId };
}

function normState(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  const up = t.toUpperCase();
  if (up.length === 2 && CORRIDOR_STATES.includes(up as CorridorState)) return up;
  const lo = t.toLowerCase();
  return STATE_NAME_TO_CODE[lo] ?? null;
}

function stateFromLocation(loc: {
  addressComponents: unknown;
  addressRaw: string;
}): string | null {
  const ac = loc.addressComponents as Record<string, unknown> | null | undefined;
  if (ac && typeof ac === 'object') {
    const s = normState(typeof ac.state === 'string' ? ac.state : null);
    if (s) return s;
  }
  const raw = loc.addressRaw ?? '';
  const m = raw.match(/\b(MI|IN|OH|KY|WV|VA|TN|NC|SC)\b/i);
  if (m) return m[1]!.toUpperCase();
  return null;
}

function scoreRow(
  loc: {
    addressNormalized: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    locationName: string | null;
    metadata: unknown;
    Company: { status: string | null; website: string | null; phone: string | null; email: string | null };
  }
): number {
  let s = 0;
  if (loc.addressNormalized?.trim()) s += 5;
  if (loc.phone?.trim()) s += 3;
  if (loc.email?.trim()) s += 3;
  if (loc.website?.trim()) s += 3;
  if (loc.Company.phone?.trim()) s += 2;
  if (loc.Company.email?.trim()) s += 2;
  if (loc.Company.website?.trim()) s += 2;
  if (loc.locationName?.trim()) s += 2;
  if (loc.Company.status?.trim()) s += 2;
  if (loc.metadata != null) s += 1;
  return s;
}

function makeClient(): { prisma: PrismaClient; pool: Pool } {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { prisma, pool };
}

/** Works with PrismaClient or interactive `$transaction` client. */
type DbExec = Pick<PrismaClient, 'company' | 'location'>;

async function upsertSeedCompany(
  db: DbExec,
  st: CorridorState,
  orgId: string | null
): Promise<{ companyId: string; locationId: string }> {
  const row = SEED_ROWS[st];
  const companyId = `${SLIM_COMPANY_PREFIX}${st.toLowerCase()}`;
  const locationId = `${SLIM_COMPANY_PREFIX}loc-${st.toLowerCase()}`;
  const now = new Date();

  await db.company.upsert({
    where: { id: companyId },
    create: {
      id: companyId,
      name: row.companyName,
      website: row.website,
      phone: row.phone,
      email: row.email,
      status: row.companyStatus,
      isSeller: false,
      hidden: false,
      orgId,
      primaryLocationId: locationId,
      metadata: row.companyMeta as Prisma.InputJsonValue,
      updatedAt: now
    },
    update: {
      name: row.companyName,
      website: row.website,
      phone: row.phone,
      email: row.email,
      status: row.companyStatus,
      isSeller: false,
      hidden: false,
      orgId,
      primaryLocationId: locationId,
      metadata: row.companyMeta as Prisma.InputJsonValue,
      updatedAt: now
    }
  });

  await db.location.upsert({
    where: { id: locationId },
    create: {
      id: locationId,
      companyId,
      addressRaw: row.addressRaw,
      addressNormalized: row.addressNormalized,
      addressComponents: {
        city: row.city,
        state: row.state,
        postal_code: row.postal_code,
        country: row.country
      } as Prisma.InputJsonValue,
      latitude: new Prisma.Decimal(row.lat),
      longitude: new Prisma.Decimal(row.lng),
      locationName: row.locationName,
      phone: row.phone,
      email: row.email,
      website: row.website,
      metadata: row.locationMeta as Prisma.InputJsonValue,
      updatedAt: now
    },
    update: {
      addressRaw: row.addressRaw,
      addressNormalized: row.addressNormalized,
      addressComponents: {
        city: row.city,
        state: row.state,
        postal_code: row.postal_code,
        country: row.country
      } as Prisma.InputJsonValue,
      latitude: new Prisma.Decimal(row.lat),
      longitude: new Prisma.Decimal(row.lng),
      locationName: row.locationName,
      phone: row.phone,
      email: row.email,
      website: row.website,
      metadata: row.locationMeta as Prisma.InputJsonValue,
      updatedAt: now
    }
  });

  return { companyId, locationId };
}

async function main(): Promise<void> {
  const { apply, confirm, orgId } = parseArgs(process.argv);

  const { prisma, pool } = makeClient();

  try {
    const locs = await prisma.location.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        Company: {
          hidden: false,
          isSeller: false,
          ...(orgId ? { orgId } : {})
        }
      },
      include: {
        Company: {
          select: {
            id: true,
            status: true,
            website: true,
            phone: true,
            email: true
          }
        }
      }
    });

    const byState = new Map<CorridorState, { locId: string; companyId: string; score: number }[]>();
    for (const loc of locs) {
      const st = stateFromLocation(loc) as CorridorState | null;
      if (!st || !CORRIDOR_STATES.includes(st)) continue;
      const score = scoreRow(loc);
      const arr = byState.get(st) ?? [];
      arr.push({ locId: loc.id, companyId: loc.companyId, score });
      byState.set(st, arr);
    }

    const pickedCompanyIds = new Set<string>();
    const picks: { state: CorridorState; companyId: string; locationId: string; source: 'existing' | 'seed' }[] = [];

    for (const st of CORRIDOR_STATES) {
      const candidates = (byState.get(st) ?? [])
        .filter((c) => !pickedCompanyIds.has(c.companyId))
        .sort((a, b) => b.score - a.score);
      const best = candidates[0];
      if (best) {
        pickedCompanyIds.add(best.companyId);
        picks.push({ state: st, companyId: best.companyId, locationId: best.locId, source: 'existing' });
      } else {
        const companyId = `${SLIM_COMPANY_PREFIX}${st.toLowerCase()}`;
        const locationId = `${SLIM_COMPANY_PREFIX}loc-${st.toLowerCase()}`;
        pickedCompanyIds.add(companyId);
        picks.push({ state: st, companyId, locationId, source: 'seed' });
      }
    }

    const keeperIds = [...pickedCompanyIds];

    const deleteWhere = orgId
      ? { id: { notIn: keeperIds }, orgId }
      : { id: { notIn: keeperIds } };

    const toDelete = await prisma.company.findMany({
      where: deleteWhere,
      select: { id: true, name: true, orgId: true, isSeller: true }
    });

    console.log(JSON.stringify({ picks, deleteCount: toDelete.length }, null, 2));

    if (!apply) {
      console.log('\nDry run only. Re-run with --apply --confirm ' + CONFIRM + ' to execute.');
      return;
    }
    if (confirm !== CONFIRM) {
      console.error(`Refusing to run: pass --confirm ${CONFIRM}`);
      process.exit(1);
    }

    const backupPath = join(
      process.cwd(),
      'exports',
      `slim-corridor-deleted-ids-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    await mkdir(join(process.cwd(), 'exports'), { recursive: true });
    await writeFile(
      backupPath,
      JSON.stringify(
        {
          deletedAt: new Date().toISOString(),
          keeperCompanyIds: keeperIds,
          picks,
          deletedCompanyIds: toDelete.map((c) => c.id),
          orgFilter: orgId ?? null
        },
        null,
        2
      ),
      'utf8'
    );
    console.log('Wrote backup id list:', backupPath);

    await prisma.$transaction(async (tx) => {
      for (const p of picks) {
        if (p.source === 'seed') {
          await upsertSeedCompany(tx, p.state, orgId ?? null);
        }
      }

      await tx.meeting.deleteMany({});
      await tx.targetNote.deleteMany({});
      await tx.routeStop.deleteMany({});
      await tx.route.deleteMany({});
      await tx.target.deleteMany({});
      await tx.mapPin.deleteMany({});
      await tx.hiddenDot.deleteMany({});

      await tx.customer.updateMany({
        where: { companyId: { notIn: keeperIds } },
        data: { companyId: null }
      });

      await tx.company.updateMany({
        data: { parentCompanyDbId: null }
      });

      await tx.company.updateMany({
        where: { id: { notIn: keeperIds } },
        data: { primaryLocationId: null }
      });

      for (const p of picks) {
        await tx.company.update({
          where: { id: p.companyId },
          data: { primaryLocationId: p.locationId }
        });
        await tx.location.deleteMany({
          where: { companyId: p.companyId, id: { not: p.locationId } }
        });
      }

      await tx.company.deleteMany({ where: deleteWhere });
    });

    console.log('Done. Corridor demo: 9 companies (buyers), 9 locations, no sellers, no MapPin/HiddenDot, no Targets/Routes.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
