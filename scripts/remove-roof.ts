#!/usr/bin/env npx tsx
/**
 * Remove all companies and locations that include "roof" (case insensitive)
 * in company name or location address.
 */

import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const roof = { contains: 'roof', mode: 'insensitive' as const };

  // 1. Delete locations with "roof" in address
  const deletedLocations = await prisma.location.deleteMany({
    where: { addressRaw: roof }
  });

  // 2. Delete companies with "roof" in name (cascade deletes their locations)
  const deletedCompanies = await prisma.company.deleteMany({
    where: { name: roof }
  });

  console.log('Done.');
  console.log('Deleted locations (address contained "roof"):', deletedLocations.count);
  console.log('Deleted companies (name contained "roof"):', deletedCompanies.count);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
