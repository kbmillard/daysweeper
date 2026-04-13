#!/usr/bin/env node
/**
 * Replace all MapPins with coordinates from public/dots-pins.json.
 * Creates a backup of existing MapPins first.
 *
 * Usage:
 *   node scripts/replace-mappins-from-dots.mjs
 */
import pg from 'pg';
import { config } from 'dotenv';
import { join } from 'path';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const dotsPath = join(process.cwd(), 'public/dots-pins.json');
const backupsDir = join(process.cwd(), 'backups');
mkdirSync(backupsDir, { recursive: true });

const parsed = JSON.parse(readFileSync(dotsPath, 'utf8'));
const pins = Array.isArray(parsed?.pins) ? parsed.pins : [];

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = join(backupsDir, `mappins-pre-replace-${ts}.json`);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  const existing = await client.query(
    'SELECT id, latitude, longitude, COALESCE(hidden, false) AS hidden, "createdAt" FROM "MapPin"'
  );
  writeFileSync(backupPath, JSON.stringify(existing.rows));

  await client.query('BEGIN');
  await client.query('DELETE FROM "MapPin"');

  for (const p of pins) {
    const lat = Number(p?.lat);
    const lng = Number(p?.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    await client.query(
      'INSERT INTO "MapPin" (id, latitude, longitude) VALUES ($1, $2, $3)',
      [randomUUID(), lat, lng]
    );
  }

  // Hidden column may not exist in some environments; ignore if absent.
  try {
    await client.query('UPDATE "MapPin" SET hidden = false');
  } catch {}

  await client.query('COMMIT');

  const after = await client.query('SELECT COUNT(*)::int AS count FROM "MapPin"');
  console.log('Backup written:', backupPath);
  console.log('Pins loaded from dots file:', pins.length);
  console.log('MapPins after replace:', after.rows[0].count);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('replace-mappins-from-dots failed:', err?.message || err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
