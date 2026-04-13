#!/usr/bin/env node
/**
 * Clear Company.primaryLocationId when it points to a missing location or wrong company.
 * Safe to run multiple times. Requires DATABASE_URL (e.g. from .env.local).
 *
 * Usage: node scripts/repair-company-primary-location.mjs
 */
import pg from 'pg';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
try {
  const r = await pool.query(`
    UPDATE "Company" c
    SET "primaryLocationId" = NULL, "updatedAt" = NOW()
    WHERE c."primaryLocationId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Location" l
        WHERE l.id = c."primaryLocationId" AND l."companyId" = c.id
      )
    RETURNING c.id
  `);
  console.log('Cleared invalid primaryLocationId for companies:', r.rowCount);
} finally {
  await pool.end();
}
