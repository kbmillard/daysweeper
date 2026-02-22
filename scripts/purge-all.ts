#!/usr/bin/env npx tsx
/**
 * Purge all app data (companies, locations, targets, routes, etc.)
 * Usage: npx tsx scripts/purge-all.ts
 */

import { config } from "dotenv";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

config({ path: join(process.cwd(), ".env.local") });
config({ path: join(process.cwd(), ".env") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.$transaction([
    prisma.warehouseItem.deleteMany({}),
    prisma.meeting.deleteMany({}),
    prisma.targetNote.deleteMany({}),
    prisma.routeStop.deleteMany({}),
    prisma.route.deleteMany({}),
    prisma.target.deleteMany({}),
    prisma.location.deleteMany({}),
    prisma.customerInteraction.deleteMany({}),
    prisma.customer.deleteMany({}),
    prisma.company.deleteMany({}),
  ]);
  console.log("Purged all companies, locations, targets, routes, etc.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
