#!/usr/bin/env node
/**
 * Ensures Route, RouteStop, and Target tables exist for Add to LastLeg (GET /api/targets, POST add-to-route).
 * Run during build: node scripts/ensure-route-tables.mjs
 * No-op if DATABASE_URL is missing. Safe to run multiple times (uses IF NOT EXISTS).
 */
import { Client } from 'pg';

const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!dbUrl) {
  console.log('No DATABASE_URL, skipping ensure-route-tables');
  process.exit(0);
}

const client = new Client({ connectionString: dbUrl });

async function run(q) {
  await client.query(q);
}

async function main() {
  try {
    await client.connect();

    // Create enums if not exist (PostgreSQL has no CREATE TYPE IF NOT EXISTS)
    for (const [name, values] of [
      ['GeocodeStatus', ['missing', 'queued', 'geocoded', 'failed']],
      ['AccountState', ['ACCOUNT', 'NEW_UNCONTACTED', 'NEW_CONTACTED_NO_ANSWER']],
      ['SupplyTier', ['OEM', 'TIER_1', 'TIER_2', 'TIER_3', 'LOGISTICS_3PL', 'TOOLING_CAPITAL_EQUIPMENT', 'AFTERMARKET_SERVICES']],
      ['StopOutcome', ['VISITED', 'NO_ANSWER', 'WRONG_ADDRESS', 'FOLLOW_UP']]
    ]) {
      try {
        await client.query(`CREATE TYPE "${name}" AS ENUM (${values.map((v) => `'${v}'`).join(', ')});`);
      } catch (e) {
        if (e?.code !== '42710' && !String(e?.message || '').includes('already exists')) throw e;
      }
    }

    // Route
    await run(`
      CREATE TABLE IF NOT EXISTS "Route" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "assignedToUserId" TEXT,
        "assignedToName" TEXT,
        "assignedToEmail" TEXT,
        "assignedToExternalId" TEXT,
        "scheduledFor" TIMESTAMP(3),
        "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "Route_assignedToUserId_idx" ON "Route"("assignedToUserId");`);

    // Target (minimal columns for add-to-route; omit geom)
    await run(`
      CREATE TABLE IF NOT EXISTS "Target" (
        "id" TEXT NOT NULL,
        "userId" TEXT,
        "orgId" TEXT,
        "company" TEXT NOT NULL,
        "parentCompany" TEXT,
        "website" TEXT,
        "phone" TEXT,
        "email" TEXT,
        "category" TEXT,
        "segment" TEXT,
        "tier" TEXT,
        "focus" TEXT,
        "addressRaw" TEXT NOT NULL DEFAULT '',
        "addressNormalized" TEXT,
        "addressComponents" JSONB,
        "addressConfidence" DOUBLE PRECISION,
        "latitude" DECIMAL(9,6),
        "longitude" DECIMAL(9,6),
        "geocodeStatus" "GeocodeStatus" NOT NULL DEFAULT 'missing',
        "geocodeProvider" TEXT,
        "geocodeAccuracy" TEXT,
        "geocodeMeta" JSONB,
        "geocodedAt" TIMESTAMP(3),
        "geocodeAttempts" INTEGER NOT NULL DEFAULT 0,
        "geocodeLastError" TEXT,
        "legacyJson" JSONB,
        "accountState" "AccountState" DEFAULT 'NEW_UNCONTACTED',
        "supplyTier" "SupplyTier",
        "supplyGroup" TEXT,
        "supplySubtype" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "Target_company_idx" ON "Target"("company");`);
    await run(`CREATE INDEX IF NOT EXISTS "Target_geocodeStatus_idx" ON "Target"("geocodeStatus");`);

    // RouteStop
    await run(`
      CREATE TABLE IF NOT EXISTS "RouteStop" (
        "id" TEXT NOT NULL,
        "routeId" TEXT NOT NULL,
        "targetId" TEXT NOT NULL,
        "seq" INTEGER NOT NULL,
        "outcome" "StopOutcome",
        "visitedAt" TIMESTAMP(3),
        "note" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS "RouteStop_routeId_seq_key" ON "RouteStop"("routeId", "seq");`);
    await run(`CREATE INDEX IF NOT EXISTS "RouteStop_targetId_idx" ON "RouteStop"("targetId");`);
    try {
      await client.query(`
        ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey"
        FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `);
    } catch (e) {
      if (!String(e?.message || '').includes('already exists')) throw e;
    }
    try {
      await client.query(`
        ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_targetId_fkey"
        FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `);
    } catch (e) {
      if (!String(e?.message || '').includes('already exists')) throw e;
    }

    console.log('Route, Target, RouteStop tables ensured');
  } catch (e) {
    console.error('ensure-route-tables:', e?.message || e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
