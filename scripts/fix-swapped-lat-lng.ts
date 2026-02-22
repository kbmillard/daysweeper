/**
 * One-time fix: find locations where latitude/longitude were stored swapped
 * (e.g. |latitude| > 90) and swap the columns so DB matches actual coordinates.
 * Run: npx tsx scripts/fix-swapped-lat-lng.ts
 * Requires DATABASE_URL in .env or .env.local
 */
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config({ path: '.env.local' });
config({ path: '.env' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const locs = await prisma.location.findMany({
    where: { latitude: { not: null }, longitude: { not: null } },
    select: { id: true, addressRaw: true, latitude: true, longitude: true }
  });

  let fixed = 0;
  for (const loc of locs) {
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    const absLat = Math.abs(lat);
    const absLng = Math.abs(lng);
    const shouldSwap = (absLat > 90 && absLng <= 90) || (absLng > 180 && absLat <= 90);
    if (!shouldSwap) continue;

    await prisma.location.update({
      where: { id: loc.id },
      data: {
        latitude: lng,
        longitude: lat,
        updatedAt: new Date()
      }
    });
    fixed++;
    console.log(`Fixed ${loc.id}: "${(loc.addressRaw ?? '').slice(0, 50)}..." (was lat=${lat}, lng=${lng})`);
  }

  console.log(`Done. Swapped latitude/longitude for ${fixed} location(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
