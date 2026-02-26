#!/usr/bin/env node
import pg from 'pg';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const c = await pool.query('UPDATE "Company" SET hidden = false');
const m = await pool.query('UPDATE "MapPin" SET hidden = false');
console.log('Unhid companies:', c.rowCount, 'map pins:', m.rowCount);
await pool.end();
