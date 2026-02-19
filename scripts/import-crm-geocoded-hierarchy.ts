#!/usr/bin/env node
/**
 * Import crm_parent_subsidiary_hierarchy_v4_geocoded.json into the DB.
 * Upserts all companies (by externalId), links parents, upserts all locations
 * with latitude/longitude, then adds a placeholder location for every company
 * that has none (e.g. parent-only companies). Expected: 1055 locations from file
 * + ~332–351 placeholders = 1387–1406 total so every company has at least one location.
 *
 * Run: pnpm run import-crm-geocoded (or npx tsx scripts/import-crm-geocoded-hierarchy.ts)
 * Requires: DATABASE_URL in .env.local
 */

import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

config({ path: join(process.cwd(), ".env.local") });
config({ path: join(process.cwd(), ".env") });

const ROOT = process.cwd();
const INPUT_PATH = join(ROOT, "crm_parent_subsidiary_hierarchy_v4_geocoded.json");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type CompanyFlat = {
  externalId: string;
  name: string;
  website?: string | null;
  companyKey?: string | null;
  tier?: string | null;
  segment?: string | null;
  category?: string | null;
  subtypeGroup?: string | null;
  subtype?: string | null;
  parentExternalId?: string | null;
  parentName?: string | null;
  subsidiaryExternalIds?: string[];
  locationExternalIds?: string[];
  keyProducts?: string[] | null;
  industryKeywords?: string[] | null;
  contactInfo?: { phone?: string; email?: string } | null;
};

type LocationFlat = {
  externalId: string;
  companyExternalId: string;
  company?: string;
  website?: string | null;
  addressRaw: string;
  addressComponents?: Record<string, unknown> | null;
  addressConfidence?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  segment?: string | null;
  tier?: string | null;
  category?: string | null;
};

type Hierarchy = {
  flat: {
    companies: CompanyFlat[];
    locations: LocationFlat[];
  };
};

async function main() {
  console.log("Loading", INPUT_PATH);
  const hierarchy = JSON.parse(readFileSync(INPUT_PATH, "utf-8")) as Hierarchy;
  const companies = hierarchy.flat?.companies ?? [];
  const locations = hierarchy.flat?.locations ?? [];
  if (!companies.length) {
    console.error("No companies in hierarchy");
    process.exit(1);
  }

  const now = new Date();
  const companyMap = new Map<string, string>(); // externalId -> db id
  const parentMap = new Map<string, string>(); // externalId -> parentExternalId

  // PASS 1: Upsert companies
  console.log("Pass 1: Upserting", companies.length, "companies...");
  const CHUNK = 100;
  for (let i = 0; i < companies.length; i += CHUNK) {
    const slice = companies.slice(i, i + CHUNK);
    await Promise.all(
      slice.map(async (c) => {
        const externalId = c.externalId;
        if (!externalId || !c.name?.trim()) return;
        const company = await prisma.company.upsert({
          where: { externalId },
          update: {
            name: c.name.trim(),
            companyKey: c.companyKey ?? null,
            website: c.website ?? null,
            phone: c.contactInfo?.phone ?? null,
            email: c.contactInfo?.email ?? null,
            tier: c.tier ?? null,
            segment: c.segment ?? null,
            category: c.category ?? null,
            subtype: c.subtype ?? null,
            subtypeGroup: c.subtypeGroup ?? null,
            externalParentId: c.parentExternalId ?? null,
            metadata: {
              ...(c.keyProducts ? { keyProducts: c.keyProducts } : {}),
              ...(c.industryKeywords ? { industryKeywords: c.industryKeywords } : {}),
              _importedAt: now.toISOString(),
              _importSource: "crm_hierarchy_geocoded",
            },
            updatedAt: now,
          },
          create: {
            id: randomUUID(),
            externalId,
            name: c.name.trim(),
            companyKey: c.companyKey ?? null,
            website: c.website ?? null,
            phone: c.contactInfo?.phone ?? null,
            email: c.contactInfo?.email ?? null,
            tier: c.tier ?? null,
            segment: c.segment ?? null,
            category: c.category ?? null,
            subtype: c.subtype ?? null,
            subtypeGroup: c.subtypeGroup ?? null,
            externalParentId: c.parentExternalId ?? null,
            metadata: {
              ...(c.keyProducts ? { keyProducts: c.keyProducts } : {}),
              ...(c.industryKeywords ? { industryKeywords: c.industryKeywords } : {}),
              _importedAt: now.toISOString(),
              _importSource: "crm_hierarchy_geocoded",
            },
            createdAt: now,
            updatedAt: now,
          },
        });
        companyMap.set(externalId, company.id);
        if (c.parentExternalId) parentMap.set(externalId, c.parentExternalId);
      })
    );
  }
  console.log("Companies:", companyMap.size);

  // PASS 2: Link parents
  console.log("Pass 2: Linking parents...");
  let parentsLinked = 0;
  for (const [externalId, parentExternalId] of parentMap) {
    const companyDbId = companyMap.get(externalId);
    if (!companyDbId) continue;
    const parent = await prisma.company.findUnique({
      where: { externalId: parentExternalId },
    });
    if (parent) {
      await prisma.company.update({
        where: { id: companyDbId },
        data: { parentCompanyDbId: parent.id, updatedAt: now },
      });
      parentsLinked++;
    }
  }
  console.log("Parents linked:", parentsLinked);

  // PASS 3: Upsert locations (with lat/lng)
  console.log("Pass 3: Upserting", locations.length, "locations (with geocodes)...");
  let locOk = 0;
  for (let i = 0; i < locations.length; i += CHUNK) {
    const slice = locations.slice(i, i + CHUNK);
    await Promise.all(
      slice.map(async (loc) => {
        const companyDbId = companyMap.get(loc.companyExternalId);
        if (!companyDbId) return;
        const lat = loc.latitude != null && !Number.isNaN(loc.latitude) ? loc.latitude : null;
        const lon = loc.longitude != null && !Number.isNaN(loc.longitude) ? loc.longitude : null;
        await prisma.location.upsert({
          where: { externalId: loc.externalId },
          update: {
            companyId: companyDbId,
            addressRaw: loc.addressRaw ?? "",
            addressComponents: loc.addressComponents ?? null,
            addressConfidence: loc.addressConfidence ?? null,
            latitude: lat,
            longitude: lon,
            metadata: {
              _importedAt: now.toISOString(),
              _importSource: "crm_hierarchy_geocoded",
            },
            updatedAt: now,
          },
          create: {
            id: randomUUID(),
            externalId: loc.externalId,
            companyId: companyDbId,
            addressRaw: loc.addressRaw ?? "",
            addressComponents: loc.addressComponents ?? null,
            addressConfidence: loc.addressConfidence ?? null,
            latitude: lat,
            longitude: lon,
            metadata: {
              _importedAt: now.toISOString(),
              _importSource: "crm_hierarchy_geocoded",
            },
            createdAt: now,
            updatedAt: now,
          },
        });
        locOk++;
      })
    );
  }
  console.log("Locations upserted:", locOk);

  // PASS 4: Placeholder locations for companies with zero locations (e.g. parent-only companies)
  const companiesWithNoLocs = companies.filter(
    (c) => !c.locationExternalIds?.length
  );
  if (companiesWithNoLocs.length > 0) {
    console.log(
      "Pass 4: Adding placeholder location for",
      companiesWithNoLocs.length,
      "companies with no locations..."
    );
    let placeholdersAdded = 0;
    for (const c of companiesWithNoLocs) {
      const companyDbId = companyMap.get(c.externalId);
      if (!companyDbId) continue;
      const placeholderExternalId = `loc_placeholder_${c.externalId}`;
      const existing = await prisma.location.findUnique({
        where: { externalId: placeholderExternalId },
      });
      if (existing) continue;
      await prisma.location.create({
        data: {
          id: randomUUID(),
          externalId: placeholderExternalId,
          companyId: companyDbId,
          addressRaw: "Address not specified",
          metadata: {
            _importedAt: now.toISOString(),
            _importSource: "crm_hierarchy_geocoded",
            _placeholder: true,
          },
          createdAt: now,
          updatedAt: now,
        },
      });
      placeholdersAdded++;
    }
    console.log("Placeholder locations added:", placeholdersAdded);
  }

  console.log("\nDone. Company pages: /dashboard/companies/{id} for each company.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
