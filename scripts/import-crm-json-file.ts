#!/usr/bin/env npx tsx
/**
 * Import CRM suppliers from a JSON file (array or { suppliers: [...] }).
 * Uses DATABASE_URL from .env.local / .env.
 *
 * Usage:
 *   npx tsx scripts/import-crm-json-file.ts path/to/file.json
 *
 * Example:
 *   npx tsx scripts/import-crm-json-file.ts data/crm-import-batches/roechling-sodecia-2026-04-12.json
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { IMPORT_GEOCODE_DEFERRED } from '../src/lib/geocode-import-deferred';
import { runCrmSupplierImport, type CrmSupplierJson } from '../src/lib/crm-supplier-import';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('Usage: npx tsx scripts/import-crm-json-file.ts <path-to.json>');
  process.exit(1);
}

const abs = join(process.cwd(), fileArg);
const raw = JSON.parse(readFileSync(abs, 'utf8')) as unknown;
const suppliers: CrmSupplierJson[] = Array.isArray(raw)
  ? raw
  : raw && typeof raw === 'object' && Array.isArray((raw as { suppliers?: unknown }).suppliers)
    ? ((raw as { suppliers: CrmSupplierJson[] }).suppliers ?? [])
    : [];

if (!suppliers.length) {
  console.error('No suppliers found (expect array or { suppliers: [...] }).');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const result = await runCrmSupplierImport(prisma, suppliers);
  console.log(JSON.stringify({ ...result, geocode: IMPORT_GEOCODE_DEFERRED }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
