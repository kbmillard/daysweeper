#!/usr/bin/env npx tsx
/**
 * Undo import of JSON/round2/new_entries_manual_additions.json:
 * Delete locations by addressRaw, then delete companies that have no locations.
 * Usage: npx tsx scripts/undo-manual-additions.ts
 */

import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

config({ path: join(process.cwd(), ".env.local") });
config({ path: join(process.cwd(), ".env") });

const ROOT = process.cwd();
const jsonPath = join(ROOT, "JSON/round2/new_entries_manual_additions.json");

async function main() {
  const raw = readFileSync(jsonPath, "utf-8");
  type Entry = { company: string; addressRaw: string };
  const entries: Entry[] = JSON.parse(raw);
  const addressRaws = entries.map((e) => e.addressRaw.trim()).filter(Boolean);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // Find locations with these addresses
  const locations = await prisma.location.findMany({
    where: { addressRaw: { in: addressRaws } },
    select: { id: true, companyId: true, addressRaw: true },
  });

  const companyIds = [...new Set(locations.map((l) => l.companyId))];

  console.log("Deleting", locations.length, "locations...");
  await prisma.location.deleteMany({
    where: { id: { in: locations.map((l) => l.id) } },
  });

  // Delete companies that now have zero locations
  const companiesWithoutLocations = await prisma.company.findMany({
    where: {
      id: { in: companyIds },
      Location: { none: {} },
    },
    select: { id: true, name: true },
  });

  console.log("Deleting", companiesWithoutLocations.length, "companies (no locations left)...");
  await prisma.company.deleteMany({
    where: { id: { in: companiesWithoutLocations.map((c) => c.id) } },
  });

  await prisma.$disconnect();
  await pool.end();

  console.log("Done. Removed", locations.length, "locations and", companiesWithoutLocations.length, "companies.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
