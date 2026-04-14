#!/usr/bin/env npx tsx
/**
 * Server batch geocode (Nominatim + Mapbox) for locations with addressRaw but missing lat/lng.
 * Same logic as POST /api/geocode/bulk — no Clerk; uses DATABASE_URL only.
 *
 * Usage:
 *   npx tsx scripts/bulk-geocode-missing.ts [maxPerBatch] [maxRounds]
 * Defaults: 100 locations per batch, up to 20 rounds (~2000 rows max).
 *
 * Requires MAPBOX_* or Nominatim-capable network; see src/lib/geocode-server.ts
 */

import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { runGeocodeBulkQueue } from '../src/lib/geocode-bulk-queue';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const maxPerBatch = Math.max(1, Number(process.argv[2]) || 100);
const maxRounds = Math.max(1, Number(process.argv[3]) || 20);

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    let totalSuccess = 0;
    let totalFailed = 0;

    for (let round = 0; round < maxRounds; round++) {
      const missing = await prisma.location.count({
        where: {
          OR: [{ latitude: null }, { longitude: null }],
          addressRaw: { not: '' }
        }
      });

      if (missing === 0) {
        console.log(
          JSON.stringify(
            { finished: true, round, remainingMissing: 0, totalSuccess, totalFailed },
            null,
            2
          )
        );
        break;
      }

      const r = await runGeocodeBulkQueue(prisma, { max: maxPerBatch });
      totalSuccess += r.success;
      totalFailed += r.failed;

      console.log(
        JSON.stringify(
          {
            round,
            missingBeforeBatch: missing,
            batchSuccess: r.success,
            batchFailed: r.failed,
            totalSuccess,
            totalFailed
          },
          null,
          2
        )
      );

      if (r.success + r.failed === 0) {
        console.log(JSON.stringify({ warning: 'No rows processed; stopping' }, null, 2));
        break;
      }
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
