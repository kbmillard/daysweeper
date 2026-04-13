#!/usr/bin/env npx tsx
/**
 * Import seller/vendor research JSON ({ vendors } or { companies + locations }) and run geocode queue.
 * Uses DATABASE_URL from .env.local / .env (point at production to update daysweeper.recyclicbravery.com).
 *
 * Usage:
 *   npx tsx scripts/import-buyer-vendor-json.ts path/to/file.json
 *   npx tsx scripts/import-buyer-vendor-json.ts path/to/file.json --remove-legacy-orbis-ky
 *
 * --remove-legacy-orbis-ky: deletes vendor_V001 and vendor_V002 (legacy KY ORBIS Bardstown/Georgetown rows)
 * before import so you only have the new vendor_KY-001-L* ORBIS locations.
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  isSellerVendorImportBody,
  runSellerVendorImport
} from '../src/lib/buyer-vendor-import';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const LEGACY_ORBIS_KY_EXTERNAL_IDS = ['vendor_V001', 'vendor_V002'] as const;

const fileArg = process.argv[2];
const removeLegacy = process.argv.includes('--remove-legacy-orbis-ky');

if (!fileArg || fileArg.startsWith('-')) {
  console.error(
    'Usage: npx tsx scripts/import-buyer-vendor-json.ts <path-to.json> [--remove-legacy-orbis-ky]'
  );
  process.exit(1);
}

const abs = join(process.cwd(), fileArg);
const body = JSON.parse(readFileSync(abs, 'utf8')) as unknown;

if (!isSellerVendorImportBody(body)) {
  console.error('JSON must include non-empty "vendors" or "companies" array.');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function removeLegacyOrbisKy(): Promise<void> {
  const ids = [...LEGACY_ORBIS_KY_EXTERNAL_IDS];
  await prisma.company.updateMany({
    where: { externalId: { in: ids } },
    data: { primaryLocationId: null }
  });
  const del = await prisma.company.deleteMany({
    where: { externalId: { in: ids } }
  });
  console.log(JSON.stringify({ removedLegacyCompanies: del.count, externalIds: ids }, null, 2));
}

async function main() {
  if (removeLegacy) {
    await removeLegacyOrbisKy();
  }
  const result = await runSellerVendorImport(prisma, body);
  console.log(JSON.stringify(result, null, 2));
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
