#!/usr/bin/env node
/**
 * Clear all WarehouseItem (bins) rows and all MapPin rows (accidental red pins).
 * Usage: node scripts/clear-bins-and-accidental-pins.mjs
 */
import pg from 'pg';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const [bins, pins] = await Promise.all([
  pool.query('DELETE FROM "WarehouseItem"'),
  pool.query('DELETE FROM "MapPin"')
]);
console.log('Deleted WarehouseItem (bins):', bins.rowCount);
console.log('Deleted MapPin (accidental pins):', pins.rowCount);
await pool.end();
