#!/usr/bin/env node
/**
 * Import CRM hierarchy v6 (profiles and group locations) into the DB.
 * 1) Upsert companies by externalId from flat.companies[] (metadata = profile + keyProducts + industryKeywords + contactInfo)
 * 2) Set parent links (parentCompanyDbId, externalParentId)
 * 3) Upsert locations by externalId from flat.locations[] (metadata = profile + capabilityTags + packagingSignals)
 * Idempotent; batched (300 per batch).
 *
 * Run: pnpm run import-crm-v6  (or see README)
 * Requires: DATABASE_URL in .env.local
 */

import { config } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

config({ path: join(process.cwd(), ".env.local") });
config({ path: join(process.cwd(), ".env") });

const ROOT = process.cwd();
const DATA_PATH = join(ROOT, "data", "crm_parent_subsidiary_hierarchy_v6_profiles_and_group_locations.json");
const ROOT_PATH = join(ROOT, "crm_parent_subsidiary_hierarchy_v6_profiles_and_group_locations.json");
const INPUT_PATH = existsSync(DATA_PATH) ? DATA_PATH : ROOT_PATH;

const BATCH_SIZE = 300;

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
  keyProducts?: string[] | null;
  industryKeywords?: string[] | null;
  contactInfo?: { phone?: string; email?: string } | null;
  profile?: Record<string, unknown> | null;
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
  profile?: Record<string, unknown> | null;
  capabilityTags?: string[] | null;
  packagingSignals?: string[] | null;
};

type HierarchyV6 = {
  flat: {
    companies: CompanyFlat[];
    locations: LocationFlat[];
  };
};

function companyMetadata(c: CompanyFlat): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    _importSource: "crm_hierarchy_v6",
    _importedAt: new Date().toISOString(),
  };
  if (c.profile != null) meta.profile = c.profile;
  if (c.keyProducts != null && c.keyProducts.length) meta.keyProducts = c.keyProducts;
  if (c.industryKeywords != null && c.industryKeywords.length) meta.industryKeywords = c.industryKeywords;
  if (c.contactInfo != null && (c.contactInfo.phone || c.contactInfo.email)) meta.contactInfo = c.contactInfo;
  return meta;
}

function locationMetadata(loc: LocationFlat): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    _importSource: "crm_hierarchy_v6",
    _importedAt: new Date().toISOString(),
  };
  if (loc.profile != null) meta.profile = loc.profile;
  if (loc.capabilityTags != null && loc.capabilityTags.length) meta.capabilityTags = loc.capabilityTags;
  if (loc.packagingSignals != null && loc.packagingSignals.length) meta.packagingSignals = loc.packagingSignals;
  return meta;
}

async function main() {
  console.log("Loading", INPUT_PATH);
  const raw = readFileSync(INPUT_PATH, "utf-8");
  const hierarchy = JSON.parse(raw) as HierarchyV6;
  const companies = hierarchy.flat?.companies ?? [];
  const locations = hierarchy.flat?.locations ?? [];
  if (!companies.length) {
    console.error("No flat.companies in file");
    process.exit(1);
  }

  const now = new Date();
  const companyIdByExternalId = new Map<string, string>();
  const parentMap = new Map<string, string>(); // child externalId -> parent externalId

  // —— Pass 1: Upsert companies by externalId ———
  console.log("Pass 1: Upserting companies (batch size %d)...", BATCH_SIZE);
  let companiesUpserted = 0;
  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = companies.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (c) => {
        const externalId = c.externalId;
        if (!externalId || !String(c.name ?? "").trim()) return;
        const meta = companyMetadata(c);
        const company = await prisma.company.upsert({
          where: { externalId },
          update: {
            name: (c.name ?? "").trim(),
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
            metadata: meta as object,
            updatedAt: now,
          },
          create: {
            id: randomUUID(),
            externalId,
            name: (c.name ?? "").trim(),
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
            metadata: meta as object,
            createdAt: now,
            updatedAt: now,
          },
        });
        companyIdByExternalId.set(externalId, company.id);
        if (c.parentExternalId) parentMap.set(externalId, c.parentExternalId);
      })
    );
    companiesUpserted += batch.length;
    console.log("  companies %d / %d", Math.min(i + BATCH_SIZE, companies.length), companies.length);
  }
  console.log("Pass 1 done. Companies upserted: %d", companiesUpserted);

  // —— Pass 2: Set parent links ———
  console.log("Pass 2: Setting parent links...");
  let parentsLinked = 0;
  for (const [childExternalId, parentExternalId] of parentMap) {
    const childId = companyIdByExternalId.get(childExternalId);
    if (!childId) continue;
    const parent = await prisma.company.findUnique({ where: { externalId: parentExternalId } });
    if (!parent) continue;
    await prisma.company.update({
      where: { id: childId },
      data: { parentCompanyDbId: parent.id, externalParentId: parentExternalId, updatedAt: now },
    });
    parentsLinked++;
  }
  console.log("Pass 2 done. Parents linked: %d", parentsLinked);

  // —— Pass 3: Upsert locations by externalId ———
  if (locations.length === 0) {
    console.log("Pass 3: No flat.locations to import.");
  } else {
    console.log("Pass 3: Upserting locations (batch size %d)...", BATCH_SIZE);
    for (let i = 0; i < locations.length; i += BATCH_SIZE) {
      const batch = locations.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (loc) => {
          const companyId = companyIdByExternalId.get(loc.companyExternalId);
          if (!companyId) return;
          const externalId = loc.externalId;
          if (!externalId) return;
          const meta = locationMetadata(loc);
          const lat =
            loc.latitude != null && !Number.isNaN(Number(loc.latitude)) ? Number(loc.latitude) : null;
          const lon =
            loc.longitude != null && !Number.isNaN(Number(loc.longitude)) ? Number(loc.longitude) : null;
          const addressRaw = (loc.addressRaw ?? "").trim() || " ";
          await prisma.location.upsert({
            where: { externalId },
            update: {
              companyId,
              addressRaw,
              addressComponents: loc.addressComponents ?? undefined,
              addressConfidence: loc.addressConfidence ?? undefined,
              latitude: lat,
              longitude: lon,
              metadata: meta as object,
              updatedAt: now,
            },
            create: {
              id: randomUUID(),
              externalId,
              companyId,
              addressRaw,
              addressComponents: loc.addressComponents ?? undefined,
              addressConfidence: loc.addressConfidence ?? undefined,
              latitude: lat,
              longitude: lon,
              metadata: meta as object,
              createdAt: now,
              updatedAt: now,
            },
          });
        })
      );
      console.log("  locations %d / %d", Math.min(i + BATCH_SIZE, locations.length), locations.length);
    }
    console.log("Pass 3 done. Locations processed: %d", locations.length);
  }

  console.log("\nDone. Idempotent; safe to re-run.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
