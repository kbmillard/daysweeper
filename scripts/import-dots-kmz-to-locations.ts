#!/usr/bin/env npx tsx
/**
 * Import Dots.kmz UNHIDDEN locations into Prisma.
 * Uses ONE company "Dots". Creates only Location records (no new companies per pin).
 *
 * Usage:
 *   npx tsx scripts/import-dots-kmz-to-locations.ts [--dryRun] [--purgeBadImport]
 *
 * --purgeBadImport: Delete companies from the previous wrong run (1 company per pin, created recently)
 */

import { config } from "dotenv";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import AdmZip from "adm-zip";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

config({ path: join(process.cwd(), ".env.local") });
config({ path: join(process.cwd(), ".env") });

const ROOT = process.cwd();
const KMZ_PATH = join(ROOT, "JSON", "round2", "Dots.kmz");
const DOTS_COMPANY_EXTERNAL_ID = "dots-kmz";

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}
const dryRun = hasFlag("--dryRun");
const purgeBadImport = hasFlag("--purgeBadImport");

type Placemark = { lng: number; lat: number; address?: string };

function parseKmlPlacemarks(kmlContent: string): Placemark[] {
  const pins: Placemark[] = [];
  const placemarkRegex = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/gi;
  const seen = new Set<string>();
  let pm: RegExpExecArray | null;
  while ((pm = placemarkRegex.exec(kmlContent)) !== null) {
    const block = pm[1];
    // Only include UNHIDDEN: no <visibility>0</visibility>
    if (/<visibility>\s*0\s*<\/visibility>/i.test(block)) continue;
    const coordMatch = /<coordinates>\s*([^<]+)<\/coordinates>/i.exec(block);
    if (!coordMatch) continue;
    const parts = coordMatch[1].trim().split(/[\s,]+/);
    const lng = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    if (Number.isNaN(lng) || Number.isNaN(lat)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    const key = `${Number(lng.toFixed(5))},${Number(lat.toFixed(5))}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fullAddr = /<SimpleData name="COL5933AC294D70E95A">([^<]*)<\/SimpleData>/i.exec(block)?.[1]?.trim();
    const addr = fullAddr || /<SimpleData name="COL5933AC294D599E15">([^<]*)<\/SimpleData>/i.exec(block)?.[1]?.trim();
    pins.push({ lng, lat, address: addr });
  }
  return pins;
}

function extractKmlFromKmz(buffer: Buffer): string {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const kmlEntry = entries.find((e) => e.entryName.endsWith(".kml") && !e.isDirectory);
  if (!kmlEntry) throw new Error("No .kml in KMZ");
  return kmlEntry.getData().toString("utf-8");
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString && !dryRun) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const pool = connectionString ? new Pool({ connectionString }) : null;
  const adapter = pool ? new PrismaPg(pool) : undefined;
  const prisma = adapter ? new PrismaClient({ adapter }) : null;

  if (purgeBadImport && prisma && !dryRun) {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const bad = await prisma.company.findMany({
      where: {
        externalId: null,
        orgId: null,
        userId: null,
        createdAt: { gte: twoHoursAgo },
        Location: { some: {} }
      },
      select: { id: true }
    });
    for (const c of bad) {
      await prisma.company.delete({ where: { id: c.id } });
    }
    console.log("Purged", bad.length, "companies from bad import");
  }

  if (!existsSync(KMZ_PATH)) {
    console.error("Dots.kmz not found at", KMZ_PATH);
    process.exit(1);
  }
  const buffer = readFileSync(KMZ_PATH);
  const kmlContent = extractKmlFromKmz(buffer);
  const placemarks = parseKmlPlacemarks(kmlContent);
  console.log("Unhidden placemarks:", placemarks.length);

  if (dryRun) {
    console.log("DRY RUN – no DB writes");
    for (let i = 0; i < Math.min(5, placemarks.length); i++) {
      const p = placemarks[i];
      console.log(`  ${i + 1}. ${p.lat}, ${p.lng} (${p.address ?? "no address"})`);
    }
    if (placemarks.length > 5) console.log(`  ... and ${placemarks.length - 5} more`);
    if (pool) await pool.end();
    return;
  }

  if (!prisma) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const now = new Date();

  let dotsCompany = await prisma.company.findUnique({
    where: { externalId: DOTS_COMPANY_EXTERNAL_ID },
    select: { id: true }
  });
  if (!dotsCompany) {
    const id = randomUUID();
    await prisma.company.create({
      data: {
        id,
        externalId: DOTS_COMPANY_EXTERNAL_ID,
        name: "Dots",
        updatedAt: now
      }
    });
    dotsCompany = { id };
  }

  const companyId = dotsCompany.id;
  let locations = 0;

  for (const p of placemarks) {
    const addressRaw = (p.address ?? "").trim() || `${p.lat}, ${p.lng}`;
    const locationId = randomUUID();
    await prisma.location.create({
      data: {
        id: locationId,
        companyId,
        addressRaw,
        latitude: p.lat,
        longitude: p.lng,
        updatedAt: now
      }
    });
    locations++;
  }

  if (pool) await pool.end();
  console.log("Created", locations, "locations (1 company: Dots)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
