/**
 * Corrects a Target that was mislabeled as "Nth Degree Orthodontics" at coordinates
 * matching the DAA Draexlmaier Automotive plant in Duncan, SC (industrial site on E Main St).
 *
 * Run from repo root:
 *   npx tsx scripts/fix-duncan-draexlmaier-target.ts
 *
 * Requires DATABASE_URL in .env.local or .env
 */
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

config({ path: '.env.local' });
config({ path: '.env' });

const EXPECT_LAT = 34.89766;
const EXPECT_LNG = -82.08923;
const TOL = 0.00025;

const CORRECT = {
  company: 'DAA Draexlmaier Automotive of America LLC',
  addressRaw: '1751 E Main St, Duncan, SC 29334, USA',
  addressNormalized: '1751 East Main Street, Duncan, Spartanburg County, South Carolina 29334, United States',
  phone: '+1-864-433-8910',
  website: 'https://www.draexlmaier.us',
} as const;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required (.env.local or .env)');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function nearCoord(
  lat: number | null | undefined,
  lng: number | null | undefined
): boolean {
  if (lat == null || lng == null) return false;
  const la = Number(lat);
  const lo = Number(lng);
  return Math.abs(la - EXPECT_LAT) <= TOL && Math.abs(lo - EXPECT_LNG) <= TOL;
}

async function main() {
  const candidates = await prisma.target.findMany({
    where: {
      OR: [
        {
          AND: [
            { latitude: { gte: EXPECT_LAT - TOL, lte: EXPECT_LAT + TOL } },
            { longitude: { gte: EXPECT_LNG - TOL, lte: EXPECT_LNG + TOL } },
          ],
        },
        { company: { contains: 'Nth Degree', mode: 'insensitive' } },
      ],
    },
    include: { TargetEnrichment: true },
  });

  const matches = candidates.filter((t) => nearCoord(Number(t.latitude), Number(t.longitude)));

  if (matches.length === 0) {
    console.error(
      `No Target within ±${TOL}° of ${EXPECT_LAT}, ${EXPECT_LNG}. ` +
        `Found ${candidates.length} secondary match(es) by name only — not updating (safety).`
    );
    if (candidates.length > 0) {
      for (const c of candidates) {
        console.log(
          `  — ${c.id} company="${c.company}" lat=${c.latitude} lng=${c.longitude}`
        );
      }
    }
    process.exit(1);
  }

  if (matches.length > 1) {
    console.error('Multiple targets at this coordinate box; aborting:', matches.map((m) => m.id));
    process.exit(1);
  }

  const target = matches[0]!;
  const now = new Date();
  const existingJson =
    target.TargetEnrichment?.enrichedJson &&
    typeof target.TargetEnrichment.enrichedJson === 'object'
      ? ({ ...(target.TargetEnrichment.enrichedJson as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : {};

  const pinResearch = {
    company_name: CORRECT.company,
    companyName: CORRECT.company,
    address: CORRECT.addressRaw,
    phone: CORRECT.phone,
    website: CORRECT.website,
    industry: 'Automotive manufacturing; Tier 1 supplier (interiors, harnesses, plastics)',
    summary:
      'DAA Draexlmaier Automotive of America LLC operates the DRÄXLMAIER Group’s major U.S. manufacturing campus in Duncan, SC (1751 E Main St), supplying premium automakers including BMW. Earlier coordinate-only research incorrectly surfaced a nearby orthodontic practice on E Main St; this record is corrected to the industrial facility at the route pin.',
    confidence: 'high',
    alternative_names: [] as string[],
    sources: [
      'South Carolina Department of Commerce — DRÄXLMAIER Duncan expansion (1751 East Main Street)',
      'OSHA establishment listing — Daa Draexlmaier Automotive Of America Llc',
    ],
  };

  const snapshot = {
    legalName: CORRECT.company,
    industry: 'Automotive supplier — interiors, wiring harnesses, plastic components',
    summary: pinResearch.summary,
    contactPhone: CORRECT.phone,
    siteFunction: 'Manufacturing plant',
  };

  const placesContext =
    `Listed as: ${CORRECT.company} Address: ${CORRECT.addressRaw} Summary: ${pinResearch.summary} Source: Manual correction from satellite imagery + public facility records (replacing incorrect dental POI at nearby E Main St address).`;

  existingJson.pin_research = pinResearch;
  existingJson.snapshot = snapshot;
  existingJson.places_context = placesContext;

  await prisma.target.update({
    where: { id: target.id },
    data: {
      company: CORRECT.company,
      addressRaw: CORRECT.addressRaw,
      addressNormalized: CORRECT.addressNormalized,
      phone: CORRECT.phone,
      website: CORRECT.website,
      updatedAt: now,
    },
  });

  await prisma.targetEnrichment.upsert({
    where: { targetId: target.id },
    create: {
      id: randomUUID(),
      targetId: target.id,
      enrichedJson: existingJson as object,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      enrichedJson: existingJson as object,
      updatedAt: now,
    },
  });

  console.log(`Updated Target ${target.id}`);
  console.log(`  was: company="${target.company}"`);
  console.log(`  now: company="${CORRECT.company}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
