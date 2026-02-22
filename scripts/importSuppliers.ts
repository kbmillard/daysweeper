#!/usr/bin/env npx tsx
/**
 * Idempotent importer for supplier JSON files (arrays of objects).
 * Reads files, de-dupes by locationId or (companyKey + normalized addressRaw),
 * upserts Company and Location with parent linking. Supports --dryRun.
 *
 * Usage:
 *   npx tsx scripts/importSuppliers.ts --files JSON/round2/file1.json,JSON/round2/file2.json
 *   npx tsx scripts/importSuppliers.ts --files data/new_entries_round44_TX_suppliers_only.json --orgId ORG --userId USER
 *   npx tsx scripts/importSuppliers.ts --files JSON/round2/*.json --dryRun
 *
 * Requires: DATABASE_URL in .env.local
 */

import { config } from "dotenv";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

config({ path: join(process.cwd(), ".env.local") });
config({ path: join(process.cwd(), ".env") });

const ROOT = process.cwd();
const BATCH_SIZE = 200;

function parseArg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1]) return undefined;
  return process.argv[i + 1];
}
function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

const filesArg = parseArg("--files");
const orgId = parseArg("--orgId") ?? undefined;
const userId = parseArg("--userId") ?? undefined;
const dryRun = hasFlag("--dryRun");
const noLegacy = hasFlag("--noLegacy");

if (!filesArg?.trim()) {
  console.error("Usage: npx tsx scripts/importSuppliers.ts --files <comma-separated paths> [--orgId ORG] [--userId USER] [--dryRun] [--noLegacy]");
  process.exit(1);
}

const filePaths = filesArg.split(",").map((p) => p.trim()).filter(Boolean).map((p) => (p.startsWith("/") ? p : join(ROOT, p)));

// --- Types (matches spec) ---
type SupplierEntry = {
  company: string;
  parentCompany?: string | null;
  website?: string | null;
  tier?: string | null;
  segment?: string | null;
  addressRaw: string;
  addressComponents?: object | null;
  addressConfidence?: number | null;
  companyId?: string;
  locationId?: string;
  parentCompanyId?: string;
  supplyChainCategory?: string | null;
  supplyChainSubtypeGroup?: string | null;
  supplyChainSubtype?: string | null;
  packagingSignals?: string[] | undefined;
  capabilityTags?: string[] | undefined;
  industryKeywords?: string[] | undefined;
  legacyJson?: unknown;
  companyKey?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  [key: string]: unknown;
};

// --- Helpers ---
function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizedDomain(url: string): string {
  let u = url.trim().toLowerCase();
  u = u.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const match = u.match(/^([^/]+)/);
  return match ? match[1] : u;
}

function normalizeAddressForDedup(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip trailing " (City, ST)" or similar from company display name. */
function companyBaseName(entry: SupplierEntry): string {
  const fromLegacy = entry.legacyJson && typeof entry.legacyJson === "object" && "supplier" in entry.legacyJson
    ? (entry.legacyJson as { supplier?: { supplier_name?: string } }).supplier?.supplier_name
    : undefined;
  if (typeof fromLegacy === "string" && fromLegacy.trim()) return fromLegacy.trim();
  const name = (entry.company ?? "").trim();
  return name.replace(/\s*\([^)]*,\s*[A-Z]{2}\)\s*$/, "").trim() || name;
}

function companyExternalId(entry: SupplierEntry): string {
  if (entry.companyId?.trim()) return entry.companyId.trim();
  const web = entry.website?.trim();
  if (web) return "cmp:" + normalizedDomain(web);
  return "cmp:name:" + slug(companyBaseName(entry));
}

function companyKey(entry: SupplierEntry): string {
  const web = entry.website?.trim();
  if (web) return normalizedDomain(web);
  return slug(companyBaseName(entry));
}

function parentExternalId(entry: SupplierEntry): string | null {
  if (entry.parentCompanyId?.trim()) return entry.parentCompanyId.trim();
  const p = entry.parentCompany?.trim();
  if (p) return "cmp:name:" + slug(p.replace(/\s*\([^)]*\)\s*$/, "").trim());
  return null;
}

function locationExternalId(entry: SupplierEntry, companyExtId: string): string {
  if (entry.locationId?.trim()) return entry.locationId.trim();
  return "loc:" + companyExtId + ":" + slug((entry.addressRaw ?? "").slice(0, 120));
}

function dedupeKey(entry: SupplierEntry, companyExtId: string): string {
  if (entry.locationId?.trim()) return entry.locationId.trim();
  const key = entry.companyKey?.trim() || companyKey(entry);
  const addr = normalizeAddressForDedup(entry.addressRaw ?? "");
  return key + "|" + addr;
}

/** Build importPayload: full entry minus address fields. */
function importPayload(entry: SupplierEntry): Record<string, unknown> {
  const { addressRaw, addressComponents, addressConfidence, ...rest } = entry;
  return { ...rest };
}

/** Merge legacyJson: prefer incoming if it has more keys. */
function mergeLegacyJson(existing: unknown, incoming: unknown): unknown {
  if (incoming == null) return existing;
  if (existing == null) return incoming;
  const a = existing as Record<string, unknown>;
  const b = incoming as Record<string, unknown>;
  if (typeof a !== "object" || typeof b !== "object") return incoming;
  const aKeys = Object.keys(a).length;
  const bKeys = Object.keys(b).length;
  return bKeys >= aKeys ? { ...a, ...b } : { ...b, ...a };
}

// --- Load and de-dupe ---
const allEntries: SupplierEntry[] = [];
for (const filePath of filePaths) {
  if (!existsSync(filePath)) {
    console.warn("Skip (not found):", filePath);
    continue;
  }
  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as unknown;
  const arr = Array.isArray(data) ? data : (data as { suppliers?: unknown[] }).suppliers ?? [];
  for (const item of arr) {
    if (item && typeof item === "object" && typeof (item as SupplierEntry).addressRaw === "string") {
      allEntries.push(item as SupplierEntry);
    }
  }
}

const seen = new Set<string>();
const entries: SupplierEntry[] = [];
for (const e of allEntries) {
  const cExtId = companyExternalId(e);
  const key = dedupeKey(e, cExtId);
  if (seen.has(key)) continue;
  seen.add(key);
  entries.push(e);
}

console.log("Files:", filePaths.length, "| Raw entries:", allEntries.length, "| After de-dupe:", entries.length);
if (dryRun) console.log("DRY RUN – no DB writes");

const connectionString = process.env.DATABASE_URL;
if (!connectionString && !dryRun) {
  console.error("DATABASE_URL is required (or use --dryRun)");
  process.exit(1);
}

const pool = !dryRun && connectionString ? new Pool({ connectionString }) : null;
const adapter = pool ? new PrismaPg(pool) : undefined;
const prisma: PrismaClient | null = adapter ? new PrismaClient({ adapter }) : null;

async function main() {
  const now = new Date();
  let createdCompanies = 0;
  let updatedCompanies = 0;
  let createdLocations = 0;
  let updatedLocations = 0;
  let parentLinksSet = 0;

  const companyMap = new Map<string, string>(); // externalId -> db id
  const parentMap = new Map<string, string>(); // child externalId -> parent externalId

  // Resolve company externalId for each entry (and ensure parent placeholders exist)
  const companyExternalIds = new Map<SupplierEntry, string>();
  const parentExternalIds = new Map<SupplierEntry, string | null>();
  for (const e of entries) {
    companyExternalIds.set(e, companyExternalId(e));
    parentExternalIds.set(e, parentExternalId(e));
  }
  const allCompanyExternalIds = new Set(companyExternalIds.values());
  // Only create companies that have at least one location (no orphan parent placeholders)
  const parentSet = new Set<string>();
  for (const e of entries) {
    const pe = parentExternalIds.get(e);
    if (pe && allCompanyExternalIds.has(pe)) parentSet.add(pe);
  }

  // PASS 1: Upsert companies (including parent placeholders)
  const companyList = Array.from(allCompanyExternalIds);
  const parentNames = new Map<string, string>();
  for (const e of entries) {
    const pe = parentExternalIds.get(e);
    if (pe && e.parentCompany?.trim()) parentNames.set(pe, e.parentCompany.trim());
  }
  const entriesForExtId = new Map<string, SupplierEntry>();
  for (const e of entries) {
    const extId = companyExternalIds.get(e)!;
    if (!entriesForExtId.has(extId)) entriesForExtId.set(extId, e);
  }
  for (let i = 0; i < companyList.length; i += BATCH_SIZE) {
    const batch = companyList.slice(i, i + BATCH_SIZE);
    for (const externalId of batch) {
      const entry = entriesForExtId.get(externalId);
      const name = entry ? companyBaseName(entry) : (parentNames.get(externalId) ?? externalId.replace(/^cmp:name:/, "").replace(/-/g, " "));
      const web = entry?.website?.trim();
      const tier = entry?.tier ?? null;
      const segment = entry?.segment ?? null;
      const category = entry?.supplyChainCategory ?? null;
      const subtypeGroup = entry?.supplyChainSubtypeGroup ?? null;
      const subtype = entry?.supplyChainSubtype ?? null;
      const key = entry ? companyKey(entry) : slug(name);
      const payload = entry ? importPayload(entry) : {};
      const legacy = entry?.legacyJson;

      if (dryRun) {
        companyMap.set(externalId, "dry-run-" + externalId);
        createdCompanies++;
        const pe = entry ? parentExternalIds.get(entry) : null;
        if (pe) parentMap.set(externalId, pe);
        continue;
      }

      const existing = await prisma!.company.findUnique({ where: { externalId }, select: { id: true, name: true, website: true, legacyJson: true, metadata: true } });
      const mergedLegacy = noLegacy
        ? null
        : existing?.legacyJson != null && legacy != null
          ? mergeLegacyJson(existing.legacyJson, legacy)
          : (legacy ?? existing?.legacyJson ?? null);
      const metadata = (existing?.metadata as Record<string, unknown>) ?? {};
      const nextMetadata = { ...metadata, importPayload: payload } as object;

      const updateWebsite = web ? web : (existing?.website ?? null);
      const company = await prisma!.company.upsert({
        where: { externalId },
        update: {
          name,
          ...(updateWebsite != null && { website: updateWebsite }),
          companyKey: key,
          tier,
          segment,
          category,
          subtypeGroup,
          subtype,
          externalParentId: (entry ? parentExternalIds.get(entry) : null) ?? undefined,
          orgId: orgId ?? undefined,
          userId: userId ?? undefined,
          legacyJson: mergedLegacy as object,
          metadata: nextMetadata,
          updatedAt: now,
        },
        create: {
          id: randomUUID(),
          externalId,
          name,
          website: updateWebsite,
          companyKey: key,
          tier,
          segment,
          category,
          subtypeGroup,
          subtype,
          externalParentId: (entry ? parentExternalIds.get(entry) : null) ?? undefined,
          orgId: orgId ?? undefined,
          userId: userId ?? undefined,
          legacyJson: (mergedLegacy as object) ?? undefined,
          metadata: nextMetadata,
          createdAt: now,
          updatedAt: now,
        },
      });
      companyMap.set(externalId, company.id);
      if (existing) updatedCompanies++; else createdCompanies++;
      const pe = entry ? parentExternalIds.get(entry) : null;
      if (pe) parentMap.set(externalId, pe);
    }
    console.log("Companies batch", Math.floor(i / BATCH_SIZE) + 1, "/", Math.ceil(companyList.length / BATCH_SIZE));
  }

  // PASS 2: Parent links
  for (const [childExtId, parentExtId] of parentMap) {
    const childDbId = companyMap.get(childExtId);
    const parent = parentExtId ? companyMap.get(parentExtId) : null;
    if (!childDbId || !parent) continue;
    if (dryRun) {
      parentLinksSet++;
      continue;
    }
    await prisma!.company.update({
      where: { id: childDbId },
      data: { parentCompanyDbId: parent, externalParentId: parentExtId, updatedAt: now },
    });
    parentLinksSet++;
  }
  console.log("Parent links set:", parentLinksSet);

  // PASS 3: Locations
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    for (const entry of batch) {
      const companyExtId = companyExternalIds.get(entry)!;
      const companyDbId = companyMap.get(companyExtId);
      if (!companyDbId) continue;
      const locExtId = locationExternalId(entry, companyExtId);
      const addressRaw = (entry.addressRaw ?? "").trim() || " ";
      const addressComponents = entry.addressComponents ?? null;
      const addressConfidence = entry.addressConfidence ?? null;
      const lat = entry.latitude != null && !Number.isNaN(entry.latitude) ? entry.latitude : null;
      const lng = entry.longitude != null && !Number.isNaN(entry.longitude) ? entry.longitude : null;
      const tags: Record<string, unknown> = {};
      if (entry.capabilityTags?.length) tags.capabilityTags = entry.capabilityTags;
      if (entry.packagingSignals?.length) tags.packagingSignals = entry.packagingSignals;
      if (entry.industryKeywords?.length) tags.industryKeywords = entry.industryKeywords;
      const metadata = Object.keys(tags).length ? { tags } : {};
      const legacy = entry.legacyJson;

      if (dryRun) {
        console.log("[dryRun] Location upsert:", locExtId, addressRaw.slice(0, 40) + "...");
        createdLocations++;
        continue;
      }

      const existing = await prisma!.location.findUnique({ where: { externalId: locExtId }, select: { id: true, legacyJson: true } });
      const mergedLegacy = noLegacy
        ? null
        : existing?.legacyJson != null && legacy != null
          ? mergeLegacyJson(existing.legacyJson, legacy)
          : (legacy ?? existing?.legacyJson ?? null);

      await prisma!.location.upsert({
        where: { externalId: locExtId },
        update: {
          companyId: companyDbId,
          addressRaw,
          addressComponents: addressComponents as object | null,
          addressConfidence,
          latitude: lat,
          longitude: lng,
          legacyJson: mergedLegacy as object,
          metadata: metadata as object,
          updatedAt: now,
        },
        create: {
          id: randomUUID(),
          externalId: locExtId,
          companyId: companyDbId,
          addressRaw,
          addressComponents: addressComponents as object | null,
          addressConfidence,
          latitude: lat,
          longitude: lng,
          legacyJson: (mergedLegacy as object) ?? undefined,
          metadata: metadata as object,
          createdAt: now,
          updatedAt: now,
        },
      });
      if (existing) updatedLocations++; else createdLocations++;
    }
    console.log("Locations batch", Math.floor(i / BATCH_SIZE) + 1, "/", Math.ceil(entries.length / BATCH_SIZE));
  }

  console.log("\nDone.");
  console.log("createdCompanies:", createdCompanies, "updatedCompanies:", updatedCompanies);
  console.log("createdLocations:", createdLocations, "updatedLocations:", updatedLocations);
  console.log("parentLinksSet:", parentLinksSet);
  if (dryRun) console.log("(dry run – no changes written)");
}

main()
  .then(() => prisma?.$disconnect?.())
  .catch((e) => {
    console.error(e);
    prisma?.$disconnect?.();
    process.exit(1);
  });
