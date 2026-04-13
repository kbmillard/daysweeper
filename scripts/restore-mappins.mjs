#!/usr/bin/env node
/**
 * Restore MapPins from backup.
 * Usage: node scripts/restore-mappins.mjs
 */
import pg from 'pg';
import { config } from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const backupPath = join(process.cwd(), 'backups/mappins-2026-02-26T17-46-20-508Z.json');
const pins = JSON.parse(readFileSync(backupPath, 'utf8'));

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

for (const p of pins) {
  await pool.query(
    `INSERT INTO "MapPin" (id, latitude, longitude, hidden, "createdAt")
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [p.id, p.latitude, p.longitude, p.hidden ?? false, p.createdAt]
  );
}

console.log('Restored MapPins:', pins.length);
await pool.end();
