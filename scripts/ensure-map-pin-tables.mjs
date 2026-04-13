#!/usr/bin/env node
/**
 * Ensures MapPin and HiddenDot tables exist (for deployments where migrate deploy is not run).
 * Run during build: node scripts/ensure-map-pin-tables.mjs
 * No-op if DATABASE_URL is missing. Safe to run multiple times (uses IF NOT EXISTS).
 */
import { Client } from 'pg';
import { isNeonDataTransferQuotaExceeded } from './lib/neon-quota.mjs';

const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!dbUrl) {
  console.log('No DATABASE_URL, skipping ensure-map-pin-tables');
  process.exit(0);
}

const client = new Client({ connectionString: dbUrl });

async function main() {
  try {
    await client.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS "MapPin" (
        "id" TEXT NOT NULL,
        "latitude" DECIMAL(10,6) NOT NULL,
        "longitude" DECIMAL(11,6) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MapPin_pkey" PRIMARY KEY ("id")
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "MapPin_latitude_longitude_idx" ON "MapPin"("latitude", "longitude")
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "HiddenDot" (
        "id" TEXT NOT NULL,
        "latitude" DECIMAL(10,6) NOT NULL,
        "longitude" DECIMAL(11,6) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "HiddenDot_pkey" PRIMARY KEY ("id")
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "HiddenDot_latitude_longitude_key" ON "HiddenDot"("latitude", "longitude")
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "HiddenDot_latitude_longitude_idx" ON "HiddenDot"("latitude", "longitude")
    `);

    console.log('MapPin and HiddenDot tables ensured');
  } catch (e) {
    if (isNeonDataTransferQuotaExceeded(e)) {
      console.warn(
        'ensure-map-pin-tables: Neon data transfer quota exceeded; skipping (upgrade Neon or run this script locally).'
      );
      process.exit(0);
    }
    console.error('ensure-map-pin-tables:', e?.message || e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
