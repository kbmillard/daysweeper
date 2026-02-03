#!/usr/bin/env node
/**
 * Keep running geocode-locations.mjs until all 658 locations have lat/lng or no progress.
 * Run: node scripts/geocode-until-done.mjs
 */
import { spawn } from 'child_process';
import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.vercel' });
config({ path: '.env.local' });
config({ path: '.env' });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function getCount() {
  const r = await pool.query(
    'SELECT COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) AS with_geocode, COUNT(*) AS total FROM "Location"'
  );
  return { withGeocode: parseInt(r.rows[0].with_geocode, 10), total: parseInt(r.rows[0].total, 10) };
}

function runGeocode() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [process.cwd() + '/scripts/geocode-locations.mjs'], {
      cwd: process.cwd(),
      stdio: 'inherit'
    });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    child.on('error', reject);
  });
}

async function main() {
  const target = 658;
  let prev = 0;
  while (true) {
    const { withGeocode, total } = await getCount();
    console.log(`\n--- Geocoded: ${withGeocode} / ${total} (target ${target}) ---\n`);
    if (withGeocode >= target) {
      console.log('Done: all locations have geocode.');
      break;
    }
    if (withGeocode === prev) {
      console.log('No progress this pass; stopping.');
      break;
    }
    prev = withGeocode;
    await runGeocode();
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
