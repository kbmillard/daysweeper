#!/usr/bin/env node
/**
 * Sync MapPin table to exactly match public/dots-pins.json (full replace).
 *
 * The previous additive sync could inflate counts when the DB had duplicate
 * coordinates at slightly different float precision (Set collapsed keys while
 * rows remained, so "missing" inserts duplicated pins).
 *
 * Usage:
 *   node scripts/sync-mappins-from-dots-json.mjs
 */
import pg from 'pg';
import { config } from 'dotenv';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { isNeonDataTransferQuotaExceeded } from './lib/neon-quota.mjs';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!dbUrl) {
  console.log('No DATABASE_URL, skipping mappin sync');
  process.exit(0);
}

const dotsPath = join(process.cwd(), 'public', 'dots-pins.json');
if (!existsSync(dotsPath)) {
  console.log('No public/dots-pins.json, skipping mappin sync');
  process.exit(0);
}

const parsed = JSON.parse(readFileSync(dotsPath, 'utf8'));
const pins = Array.isArray(parsed?.pins) ? parsed.pins : [];

const pool = new pg.Pool({ connectionString: dbUrl });
let client;
try {
  client = await pool.connect();
} catch (e) {
  if (isNeonDataTransferQuotaExceeded(e)) {
    console.warn(
      'sync-mappins-from-dots-json: Neon data transfer quota exceeded; skipping (upgrade Neon or run locally).'
    );
    await pool.end();
    process.exit(0);
  }
  throw e;
}

try {
  await client.query('BEGIN');
  await client.query('DELETE FROM "MapPin"');

  let inserted = 0;
  for (const p of pins) {
    const lat = Number(p?.lat);
    const lng = Number(p?.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    await client.query(
      'INSERT INTO "MapPin" (id, latitude, longitude) VALUES ($1, $2, $3)',
      [randomUUID(), lat, lng]
    );
    inserted += 1;
  }

  try {
    await client.query('UPDATE "MapPin" SET hidden = false');
  } catch {
    // hidden column may not exist
  }

  await client.query('COMMIT');

  const after = await client.query('SELECT COUNT(*)::int AS count FROM "MapPin"');
  console.log('Dots in file:', pins.length);
  console.log('MapPins inserted:', inserted);
  console.log('MapPins total after sync:', after.rows[0].count);
} catch (e) {
  try {
    await client.query('ROLLBACK');
  } catch {
    /* ignore */
  }
  if (isNeonDataTransferQuotaExceeded(e)) {
    console.warn(
      'sync-mappins-from-dots-json: Neon data transfer quota exceeded; skipping (upgrade Neon or run locally).'
    );
  } else {
    console.error('sync-mappins-from-dots-json failed:', e?.message || e);
    process.exitCode = 1;
  }
} finally {
  client.release();
  await pool.end();
}
