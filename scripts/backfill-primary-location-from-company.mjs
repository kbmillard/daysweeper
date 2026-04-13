#!/usr/bin/env node
/**
 * One-time / ops: copy company name, phone, website, email onto each company's primary Location,
 * and clear suppressCompanyPrimarySync so company→primary sync works again.
 *
 * Address and coordinates are already stored on Location; this aligns contact fields with the company card.
 *
 * Usage: DATABASE_URL=... node scripts/backfill-primary-location-from-company.mjs
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
    UPDATE "Location" AS l
    SET
      "locationName" = c.name,
      "phone" = c.phone,
      "website" = c.website,
      "email" = c.email,
      "updatedAt" = NOW(),
      "metadata" = CASE
        WHEN l.metadata IS NULL THEN NULL
        ELSE to_json(
          CASE
            WHEN jsonb_typeof(l.metadata::jsonb) = 'object' THEN l.metadata::jsonb - 'suppressCompanyPrimarySync'
            ELSE l.metadata::jsonb
          END
        )
      END
    FROM "Company" AS c
    WHERE c."primaryLocationId" = l.id
      AND l."companyId" = c.id
  `);
  console.log('Primary locations updated:', r.rowCount);
} finally {
  await pool.end();
}
