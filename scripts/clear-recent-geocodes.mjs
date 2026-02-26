import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query(`UPDATE "Location" SET latitude = NULL, longitude = NULL WHERE latitude IS NOT NULL AND "updatedAt" > NOW() - INTERVAL '1 hour'`);
console.log('Cleared:', r.rowCount, 'locations');
await pool.end();
