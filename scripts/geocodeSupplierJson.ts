#!/usr/bin/env npx tsx
/**
 * Geocode each address in a supplier JSON file and add latitude/longitude to each entry.
 * Writes *_geocoded.json. Then run importSuppliers.ts on that file so locations get coords on the map.
 *
 * Usage: npx tsx scripts/geocodeSupplierJson.ts --input JSON/round2/file.json [--output path] [--limit N] [--dryRun]
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const getArg = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};
const inputArg = getArg("--input");
const outputArg = getArg("--output");
const limitArg = getArg("--limit");
const limit = limitArg ? parseInt(limitArg, 10) || 0 : 0;
const dryRun = argv.includes("--dryRun");

if (!inputArg?.trim()) {
  console.error("Usage: npx tsx scripts/geocodeSupplierJson.ts --input <path> [--output path] [--limit N] [--dryRun]");
  process.exit(1);
}

const inputPath = join(ROOT, inputArg.trim());
const outputPath = outputArg
  ? join(ROOT, outputArg.trim())
  : inputPath.replace(/\.json$/i, "_geocoded.json");

const DELAY_MS = 1100;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeAddress(addr: string): string {
  if (!addr || typeof addr !== "string") return "";
  return addr
    .trim()
    .replace(/\s*-\s*Suite\s+\d+/gi, "")
    .replace(/,?\s*Suite\s+\d+/gi, "")
    .replace(/,?\s*Unit\s+\d+/gi, "")
    .replace(/\s*#\s*\d+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function geocodeNominatim(address: string): Promise<{ lat: number; lon: number } | null> {
  const q = encodeURIComponent(normalizeAddress(address) || address);
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
    { headers: { "User-Agent": "Daysweeper-geocodeSupplierJson/1.0" } }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
  const first = data?.[0];
  if (!first?.lat || !first?.lon) return null;
  const lat = parseFloat(first.lat);
  const lon = parseFloat(first.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { lat, lon };
}

async function geocodeMapbox(address: string): Promise<{ lat: number; lon: number } | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_SECRET_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  const q = encodeURIComponent(normalizeAddress(address) || address);
  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${token}&limit=1&types=address,place,locality,postcode,region,country`
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { features?: Array<{ center?: [number, number] }> };
  const center = json.features?.[0]?.center;
  if (!center || center.length < 2) return null;
  const [lng, lat] = center;
  return { lat, lon: lng };
}

async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  const n = (address ?? "").trim();
  if (!n) return null;
  const nominatim = await geocodeNominatim(n);
  if (nominatim) return { latitude: nominatim.lat, longitude: nominatim.lon };
  const mapbox = await geocodeMapbox(n);
  if (mapbox) return { latitude: mapbox.lat, longitude: mapbox.lon };
  return null;
}

type SupplierEntry = { addressRaw?: string; latitude?: number | null; longitude?: number | null; [key: string]: unknown };

async function main() {
  console.log("Reading", inputPath);
  const raw = readFileSync(inputPath, "utf-8");
  const data = JSON.parse(raw) as unknown;
  const entries = (Array.isArray(data) ? data : (data as { suppliers?: unknown[] }).suppliers ?? []) as SupplierEntry[];
  if (!entries.length) {
    console.error("No entries in JSON");
    process.exit(1);
  }

  const toProcess = limit > 0 ? entries.slice(0, limit) : entries;
  let done = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const entry = toProcess[i];
    const addr = entry.addressRaw?.trim();
    if (!addr) {
      failed++;
      continue;
    }
    if (entry.latitude != null && entry.longitude != null && !Number.isNaN(entry.latitude) && !Number.isNaN(entry.longitude)) {
      done++;
      continue;
    }
    if (dryRun) {
      console.log("[dryRun] Would geocode:", addr.slice(0, 50) + "...");
      done++;
      continue;
    }
    const result = await geocodeAddress(addr);
    if (result) {
      entry.latitude = result.latitude;
      entry.longitude = result.longitude;
      done++;
    } else {
      failed++;
    }
    if ((i + 1) % 25 === 0) console.log("  ", i + 1, "/", toProcess.length);
    await sleep(DELAY_MS);
  }

  if (!dryRun && toProcess.length > 0) {
    const out = Array.isArray(data) ? entries : { ...(data as object), suppliers: entries };
    writeFileSync(outputPath, JSON.stringify(out, null, 2), "utf-8");
    console.log("Wrote", outputPath);
  }
  console.log("Geocoded:", done, "failed:", failed);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
