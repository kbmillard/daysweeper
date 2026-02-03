#!/usr/bin/env node
/**
 * CRM Parent/Subsidiary Enrichment: fill missing websites and street-level addresses
 * using only official company websites.
 *
 * Inputs:
 *   - crm_parent_subsidiary_hierarchy_v4.json (master)
 *   - crm_parent_subsidiary_work_queue_v4.json (optional; if missing, derived from hierarchy)
 *
 * Outputs:
 *   - crm_parent_subsidiary_hierarchy_v5.json
 *   - Changelog summary (parent/subsidiary websites filled, locations with street filled, still null)
 *
 * Env: SERPAPI_KEY for website search. Optional.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { HierarchyV4, CompanyFlat, LocationFlat, WorkQueueV4, ChangelogSummary } from "./types.js";
import { searchOfficialWebsite } from "./website-finder.js";
import { crawlOfficialSite } from "./crawler.js";
import { matchAddressToLocations } from "./address-matcher.js";

const ROOT = join(process.cwd());
const HIERARCHY_V4_PATH = join(ROOT, "crm_parent_subsidiary_hierarchy_v4.json");
const WORK_QUEUE_V4_PATH = join(ROOT, "crm_parent_subsidiary_work_queue_v4.json");
const HIERARCHY_V5_PATH = join(ROOT, "crm_parent_subsidiary_hierarchy_v5.json");
const CHANGELOG_PATH = join(ROOT, "crm_enrich_changelog.json");

function loadJson<T>(path: string): T {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as T;
}

function loadHierarchy(): HierarchyV4 {
  return loadJson<HierarchyV4>(HIERARCHY_V4_PATH);
}

function loadWorkQueueOrDerive(hierarchy: HierarchyV4): { companyIds: Set<string>; locationIds: Set<string> } {
  try {
    const wq = loadJson<WorkQueueV4>(WORK_QUEUE_V4_PATH);
    return {
      companyIds: new Set(wq.companyExternalIds ?? []),
      locationIds: new Set(wq.locationExternalIds ?? []),
    };
  } catch {
    const companyIds = new Set<string>();
    const locationIds = new Set<string>();
    for (const c of hierarchy.flat.companies) {
      if (!c.website || c.website.trim() === "") companyIds.add(c.externalId);
    }
    for (const loc of hierarchy.flat.locations) {
      const hasStreet = loc.addressHasStreetNumber === true || /\d+\s+[\w\s]+(?:st|street|ave|blvd|dr|road|rd)/i.test(loc.addressRaw ?? "");
      if (!hasStreet && (loc.addressRaw ?? "").trim().length > 3) locationIds.add(loc.externalId);
    }
    return { companyIds, locationIds };
  }
}

function deepCopy<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

async function main() {
  console.log("Loading hierarchy v4...");
  const hierarchy = loadHierarchy();
  const work = loadWorkQueueOrDerive(hierarchy);
  console.log(`Work queue: ${work.companyIds.size} companies (missing website), ${work.locationIds.size} locations (missing street)`);

  const v5 = deepCopy(hierarchy) as HierarchyV4;
  v5.generatedAt = new Date().toISOString();
  v5.sourceFiles = [...(v5.sourceFiles ?? []), "crm_parent_subsidiary_hierarchy_v4.json"];
  if (!v5.stats) v5.stats = {};
  const changelog: ChangelogSummary = {
    parentWebsitesFilled: 0,
    subsidiaryWebsitesFilled: 0,
    locationsWithStreetAddressFilled: 0,
    companiesStillMissingWebsite: [],
    locationsStillMissingStreetAddress: [],
  };

  const companiesByExternalId = new Map<string, CompanyFlat>();
  for (const c of v5.flat.companies) companiesByExternalId.set(c.externalId, c);
  const locationsByExternalId = new Map<string, LocationFlat>();
  for (const l of v5.flat.locations) locationsByExternalId.set(l.externalId, l);

  const companyIdsToProcess = [...work.companyIds].filter((id) => companiesByExternalId.has(id));
  for (let i = 0; i < companyIdsToProcess.length; i++) {
    const externalId = companyIdsToProcess[i];
    const company = companiesByExternalId.get(externalId)!;
    if (company.website && company.website.trim() !== "") continue;
    console.log(`[${i + 1}/${companyIdsToProcess.length}] Finding website: ${company.name}`);
    const website = await searchOfficialWebsite(company.name);
    if (website) {
      company.website = website;
      if (company.parentExternalId == null) changelog.parentWebsitesFilled++;
      else changelog.subsidiaryWebsitesFilled++;
    }
  }

  const companiesWithWebsite = v5.flat.companies.filter((c) => c.website && c.website.trim() !== "");
  const locationsNeedingStreet = v5.flat.locations.filter((loc) => work.locationIds.has(loc.externalId));
  const locationIdsNeedingStreet = new Set(locationsNeedingStreet.map((l) => l.externalId));

  for (let i = 0; i < companiesWithWebsite.length; i++) {
    const company = companiesWithWebsite[i];
    const website = company.website!.trim();
    console.log(`[${i + 1}/${companiesWithWebsite.length}] Crawling: ${company.name} (${website})`);
    try {
      const { addresses } = await crawlOfficialSite(website, { maxPages: 50, maxDepth: 2 });
      if (addresses.length === 0) continue;
      const companyLocationIds = new Set(company.locationExternalIds ?? []);
      const subsidiaryIds = new Set(company.subsidiaryExternalIds ?? []);
      const locsToConsider: LocationFlat[] = [
        ...(company.locationExternalIds ?? []).map((id) => locationsByExternalId.get(id)).filter(Boolean) as LocationFlat[],
      ];
      for (const subId of subsidiaryIds) {
        const sub = companiesByExternalId.get(subId);
        if (sub?.locationExternalIds) {
          for (const lid of sub.locationExternalIds) {
            const loc = locationsByExternalId.get(lid);
            if (loc) locsToConsider.push(loc);
          }
        }
      }
      const locsNeedingStreet = locsToConsider.filter((l) => locationIdsNeedingStreet.has(l.externalId));
      if (locsNeedingStreet.length === 0) continue;
      const updates = matchAddressToLocations(addresses, locsNeedingStreet);
      for (const [locId, updatedAddress] of updates) {
        const loc = locationsByExternalId.get(locId);
        if (!loc) continue;
        if (!loc.metadata) loc.metadata = {};
        (loc.metadata as Record<string, unknown>).updatedAddressRaw = updatedAddress;
        changelog.locationsWithStreetAddressFilled++;
        locationIdsNeedingStreet.delete(locId);
      }
    } catch (e) {
      console.warn(`Crawl failed for ${company.name}:`, e);
    }
  }

  for (const c of v5.flat.companies) {
    if (!c.website || c.website.trim() === "") changelog.companiesStillMissingWebsite.push(c.externalId);
  }
  for (const loc of v5.flat.locations) {
    const hasStreet = loc.addressHasStreetNumber === true
      || (loc.metadata as Record<string, unknown> | undefined)?.updatedAddressRaw;
    if (!hasStreet && (loc.addressRaw ?? "").trim().length > 3) {
      changelog.locationsStillMissingStreetAddress.push(loc.externalId);
    }
  }

  console.log("Writing v5 and changelog...");
  writeFileSync(HIERARCHY_V5_PATH, JSON.stringify(v5, null, 2), "utf-8");
  writeFileSync(CHANGELOG_PATH, JSON.stringify(changelog, null, 2), "utf-8");

  console.log("\n--- Changelog ---");
  console.log("Parent websites filled:", changelog.parentWebsitesFilled);
  console.log("Subsidiary websites filled:", changelog.subsidiaryWebsitesFilled);
  console.log("Locations with street address filled:", changelog.locationsWithStreetAddressFilled);
  console.log("Companies still missing website:", changelog.companiesStillMissingWebsite.length);
  console.log("Locations still missing street address:", changelog.locationsStillMissingStreetAddress.length);
  console.log("\nOutputs:", HIERARCHY_V5_PATH, CHANGELOG_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
