#!/usr/bin/env npx tsx
/**
 * Write exports/daysweeper-sellers.kml from the database (same rows as /api/sellers/map).
 *
 * Run from repo root (requires DATABASE_URL in .env / .env.local):
 *   npx tsx scripts/export-sellers-kml.ts
 *   npx tsx scripts/export-sellers-kml.ts --out /path/to/custom.kml
 */

import { config } from 'dotenv';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { getSellerMapPins } from '../src/lib/sellers-map-data';
import { buildSellersKml } from '../src/lib/sellers-kml-document';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

async function main() {
  const outArg = process.argv.findIndex((a) => a === '--out');
  const outPath =
    outArg >= 0 && process.argv[outArg + 1]
      ? process.argv[outArg + 1]!
      : join(process.cwd(), 'exports', 'daysweeper-sellers.kml');

  const pins = await getSellerMapPins();
  const kml = buildSellersKml(pins);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, kml, 'utf8');
  console.log(`Wrote ${outPath} (${pins.length} placemarks)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
