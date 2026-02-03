#!/usr/bin/env node
/**
 * Geocode all Location rows missing lat/lng using OpenStreetMap Nominatim.
 * Run: node scripts/geocode-locations.mjs [--dry-run] [--limit N]
 */
import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.vercel' });
config({ path: '.env.local' });
config({ path: '.env' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const limit = process.argv.includes('--limit')
  ? parseInt(process.argv[process.argv.indexOf('--limit') + 1], 10) || 0
  : 0;
const dryRun = process.argv.includes('--dry-run');

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function geocodeAddress(addressRaw) {
  const q = encodeURIComponent(addressRaw.trim());
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'daysweeper-geocode/1.0' }
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const { lat, lon } = data[0];
  return { lat: parseFloat(lat), lon: parseFloat(lon) };
}

async function main() {
  const client = await pool.connect();
  try {
    let query =
      'SELECT id, "addressRaw" FROM "Location" WHERE latitude IS NULL AND longitude IS NULL AND trim("addressRaw") != \'\' ORDER BY "createdAt" ASC';
    if (limit > 0) query += ` LIMIT ${limit}`;
    const { rows } = await client.query(query);
    console.log(`Found ${rows.length} locations to geocode. Dry run: ${dryRun}`);

    let ok = 0;
    let fail = 0;
    for (let i = 0; i < rows.length; i++) {
      const { id, addressRaw } = rows[i];
      const result = await geocodeAddress(addressRaw);
      if (result) {
        if (!dryRun) {
          await client.query(
            'UPDATE "Location" SET latitude = $1, longitude = $2, "updatedAt" = now() WHERE id = $3',
            [result.lat, result.lon, id]
          );
        }
        ok++;
        console.log(`[${i + 1}/${rows.length}] ${id} -> ${result.lat}, ${result.lon}`);
      } else {
        fail++;
        console.log(`[${i + 1}/${rows.length}] ${id} -> no result`);
      }
      await sleep(1100);
    }
    console.log(`Done. Geocoded: ${ok}, failed: ${fail}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
