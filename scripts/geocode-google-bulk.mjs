#!/usr/bin/env node
/**
 * Geocode all Location rows missing lat/lng using Google Maps Geocoding API.
 * Runs in parallel batches of 10, ~5 req/sec to stay under quota.
 * Usage: node scripts/geocode-google-bulk.mjs [--limit N] [--dry-run]
 */
import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.vercel' });
config({ path: '.env.local' });
config({ path: '.env' });

const GOOGLE_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  'AIzaSyCAewdmKcmRjR3TmgwDnO-e3dTTgw8rOm8';

const BATCH = 10;       // parallel requests per round
const DELAY_MS = 200;   // ms between batches (~50 req/sec max, we do 10/200ms = 50/sec)
const limit = process.argv.includes('--limit')
  ? parseInt(process.argv[process.argv.indexOf('--limit') + 1], 10) || 0
  : 0;
const dryRun = process.argv.includes('--dry-run');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function geocode(addressRaw) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressRaw.trim())}&key=${GOOGLE_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.results?.[0]) {
      const { lat, lng } = data.results[0].geometry.location;
      return { lat, lng };
    }
    return null;
  } catch {
    return null;
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const client = await pool.connect();
  try {
    let q = 'SELECT id, "addressRaw" FROM "Location" WHERE latitude IS NULL AND longitude IS NULL AND trim("addressRaw") != \'\' ORDER BY "createdAt" ASC';
    if (limit > 0) q += ` LIMIT ${limit}`;
    const { rows } = await client.query(q);
    console.log(`Found ${rows.length} locations to geocode. Dry run: ${dryRun}`);

    let ok = 0, fail = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      await Promise.all(batch.map(async ({ id, addressRaw }) => {
        const result = await geocode(addressRaw);
        if (result) {
          if (!dryRun) {
            await client.query(
              'UPDATE "Location" SET latitude = $1, longitude = $2, "updatedAt" = now() WHERE id = $3',
              [result.lat, result.lng, id]
            );
          }
          ok++;
          process.stdout.write(`✓ `);
        } else {
          fail++;
          process.stdout.write(`✗ `);
        }
      }));
      const done = Math.min(i + BATCH, rows.length);
      console.log(`  [${done}/${rows.length}] ok:${ok} fail:${fail}`);
      if (done < rows.length) await sleep(DELAY_MS);
    }
    console.log(`\nDone. Geocoded: ${ok}, failed: ${fail}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
