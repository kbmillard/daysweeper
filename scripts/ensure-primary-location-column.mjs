#!/usr/bin/env node
/**
 * Ensures Company.primaryLocationId exists (for deployments where migrate deploy cannot run).
 * Run during build: node scripts/ensure-primary-location-column.mjs
 * No-op if DATABASE_URL is missing. Safe to run multiple times (uses IF NOT EXISTS).
 */
import { Client } from 'pg';

const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!dbUrl) {
  console.log('No DATABASE_URL, skipping ensure-primary-location-column');
  process.exit(0);
}

const client = new Client({ connectionString: dbUrl });

async function main() {
  try {
    await client.connect();
    await client.query(`
      ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "primaryLocationId" TEXT
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Company_primaryLocationId_key" ON "Company"("primaryLocationId")
    `);
    try {
      await client.query(`
        ALTER TABLE "Company" ADD CONSTRAINT "Company_primaryLocationId_fkey"
        FOREIGN KEY ("primaryLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `);
    } catch (e) {
      const msg = e?.message ?? '';
      if (msg.includes('already exists') || msg.includes('duplicate key')) {
        // constraint already there
      } else throw e;
    }
    console.log('Company.primaryLocationId column ensured');
  } catch (e) {
    console.error('ensure-primary-location-column:', e?.message || e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
