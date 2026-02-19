#!/usr/bin/env node
/**
 * Geocode every location in crm_parent_subsidiary_hierarchy_v4.json.
 * Reads the JSON, calls Nominatim (+ geocode.xyz fallback) per location address,
 * adds latitude/longitude to each location, writes a new JSON file.
 *
 * Run: node scripts/geocode-crm-hierarchy.mjs [--dry-run] [--limit N]
 * Output: crm_parent_subsidiary_hierarchy_v4_geocoded.json
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd());
const INPUT_PATH = join(ROOT, "crm_parent_subsidiary_hierarchy_v4.json");
const OUTPUT_PATH = join(ROOT, "crm_parent_subsidiary_hierarchy_v4_geocoded.json");

const limit = process.argv.includes("--limit")
  ? parseInt(process.argv[process.argv.indexOf("--limit") + 1], 10) || 0
  : 0;
const dryRun = process.argv.includes("--dry-run");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeAddressForGeocode(addr) {
  if (!addr || typeof addr !== "string") return "";
  let s = addr
    .trim()
    .replace(/\s*-\s*Suite\s+\d+/gi, "")
    .replace(/,?\s*Suite\s+\d+/gi, "")
    .replace(/,?\s*Unit\s+\d+/gi, "")
    .replace(/,?\s*Ste\.?\s*\d+/gi, "")
    .replace(/\s*#\s*\d+/gi, "")
    .replace(/,?\s*Floor\s+\d+/gi, "")
    .replace(/,?\s*Fl\.?\s*\d+/gi, "")
    .replace(/,?\s*Bldg\.?\s*\w+/gi, "");
  return s.replace(/\s*,\s*,/g, ",").replace(/^\s*,|,\s*$/g, "").trim();
}

async function geocodeNominatim(normalized) {
  const q = encodeURIComponent(normalized);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "daysweeper-geocode-crm/1.0" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const { lat, lon } = data[0];
  return { lat: parseFloat(lat), lon: parseFloat(lon) };
}

async function geocodeXyz(normalized) {
  const q = encodeURIComponent(normalized);
  const res = await fetch(`https://geocode.xyz/${q}?json=1`, {
    headers: { "User-Agent": "daysweeper-geocode-crm/1.0" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const lat = data.latt != null ? parseFloat(data.latt) : null;
  const lon = data.longt != null ? parseFloat(data.longt) : null;
  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) return null;
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

function isValid(r) {
  return r && typeof r.lat === "number" && typeof r.lon === "number" && !Number.isNaN(r.lat) && !Number.isNaN(r.lon);
}

async function geocodeAddress(addressRaw) {
  const normalized = normalizeAddressForGeocode(addressRaw) || (addressRaw || "").trim();
  if (!normalized) return null;
  let result = await geocodeNominatim(normalized);
  if (isValid(result)) return result;
  await sleep(500);
  result = await geocodeXyz(normalized);
  return isValid(result) ? result : null;
}

async function main() {
  console.log("Loading", INPUT_PATH);
  const hierarchy = JSON.parse(readFileSync(INPUT_PATH, "utf-8"));
  const locations = hierarchy?.flat?.locations ?? [];
  if (!locations.length) {
    console.error("No flat.locations found");
    process.exit(1);
  }

  for (const loc of locations) {
    if (loc.latitude === undefined) loc.latitude = null;
    if (loc.longitude === undefined) loc.longitude = null;
  }

  const toProcess = limit > 0 ? locations.slice(0, limit) : locations;
  console.log(`Geocoding ${toProcess.length} locations. Dry run: ${dryRun}`);

  let geocoded = 0;
  let failed = 0;
  for (let i = 0; i < toProcess.length; i++) {
    const loc = toProcess[i];
    if (!loc.addressRaw?.trim()) {
      failed++;
      continue;
    }
    if (dryRun) {
      geocoded++;
      continue;
    }
    const result = await geocodeAddress(loc.addressRaw);
    if (result) {
      loc.latitude = result.lat;
      loc.longitude = result.lon;
      geocoded++;
    } else {
      failed++;
    }
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${toProcess.length}`);
    await sleep(1100);
  }

  if (!dryRun) {
    hierarchy.generatedAt = new Date().toISOString();
    if (hierarchy.sourceFiles && Array.isArray(hierarchy.sourceFiles)) {
      if (!hierarchy.sourceFiles.some((f) => f.includes("geocoded")))
        hierarchy.sourceFiles.push("crm_parent_subsidiary_hierarchy_v4.json (geocoded)");
    } else {
      hierarchy.sourceFiles = ["crm_parent_subsidiary_hierarchy_v4.json (geocoded)"];
    }
    writeFileSync(OUTPUT_PATH, JSON.stringify(hierarchy, null, 2), "utf-8");
    console.log("Wrote", OUTPUT_PATH);
  }
  console.log("Done. Geocoded:", geocoded, "failed:", failed);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
