#!/usr/bin/env node
/**
 * Geocode one CSV (full_address column) via Nominatim + geocode.xyz fallback.
 * Usage: node scripts/geocode-csv-once.mjs <input.csv> [output.csv]
 * If output is omitted, input file is overwritten.
 */
import { readFileSync, writeFileSync } from "fs";

const csvPath = process.argv[2];
const outPath = process.argv[3] || csvPath;
if (!csvPath) {
  console.error("Usage: node scripts/geocode-csv-once.mjs <input.csv> [output.csv]");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeAddressForGeocode(addr) {
  if (!addr || typeof addr !== "string") return "";
  let s = addr
    .trim()
    .replace(/\s*-\s*Suite\s+\d+/gi, "")
    .replace(/,?\s*Suite\s*#?\s*[\w-]+/gi, "")
    .replace(/,?\s*Suite\s+\d+/gi, "")
    .replace(/,?\s*Bld\.?\s*[A-Za-z]?\s*/gi, "")
    .replace(/,?\s*Loft\s+\d+/gi, "")
    .replace(/,?\s*Unit\s+\d+/gi, "")
    .replace(/,?\s*Ste\.?\s*\w+/gi, "")
    .replace(/\s*#\s*\d+/gi, "")
    .replace(/,?\s*Apt\.?\s*[\w-]+/gi, "")
    .replace(/,?\s*Floor\s+\d+/gi, "")
    .replace(/,?\s*Fl\.?\s*\d+/gi, "")
    .replace(/,?\s*Bldg\.?\s*\w+/gi, "");
  s = s.replace(/\b(SE|SW|NE|NW)\s+\d{5}\s*,/gi, "$1,");
  return s.replace(/\s*,\s*,/g, ",").replace(/^\s*,|,\s*$/g, "").trim();
}

async function geocodeNominatim(normalized) {
  const q = encodeURIComponent(normalized);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "daysweeper-geocode-csv/1.0" },
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
    headers: { "User-Agent": "daysweeper-geocode-csv/1.0" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.latt === "Throttled! See geocode.xyz/pricing") return null;
  const lat = data.latt != null ? parseFloat(data.latt) : null;
  const lon = data.longt != null ? parseFloat(data.longt) : null;
  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) return null;
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

function isValid(r) {
  return (
    r &&
    typeof r.lat === "number" &&
    typeof r.lon === "number" &&
    !Number.isNaN(r.lat) &&
    !Number.isNaN(r.lon)
  );
}

async function geocodeAddress(addressRaw) {
  const raw = (addressRaw || "").trim();
  if (!raw) return null;
  const normalized = normalizeAddressForGeocode(raw) || raw;
  let result = await geocodeNominatim(normalized);
  if (isValid(result)) return result;
  await sleep(500);
  result = await geocodeXyz(normalized);
  if (isValid(result)) return result;
  if (normalized !== raw) {
    await sleep(500);
    result = await geocodeNominatim(raw);
    if (isValid(result)) return result;
    await sleep(500);
    result = await geocodeXyz(raw);
    if (isValid(result)) return result;
  }
  return null;
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function escapeCsvField(s) {
  if (s == null) return "";
  const str = String(s);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

const raw = readFileSync(csvPath, "utf-8");
const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
if (lines.length < 2) {
  console.error("CSV empty or header only");
  process.exit(1);
}

const header = parseCsvLine(lines[0]);
let fullIdx = header.indexOf("full_address");
const streetIdx = header.indexOf("street_address");
const cityIdx = header.indexOf("city");
const stateIdx = header.indexOf("state");
const zipIdx = header.indexOf("zip");
const composeFromParts =
  fullIdx < 0 &&
  streetIdx >= 0 &&
  cityIdx >= 0 &&
  stateIdx >= 0 &&
  zipIdx >= 0;
if (fullIdx < 0 && !composeFromParts) {
  console.error(
    "Need full_address column, or street_address + city + state + zip"
  );
  process.exit(1);
}

function rowFullAddress(row) {
  if (fullIdx >= 0) return (row[fullIdx] || "").trim();
  const street = (row[streetIdx] || "").trim();
  const city = (row[cityIdx] || "").trim();
  const state = (row[stateIdx] || "").trim();
  const zip = (row[zipIdx] || "").trim();
  if (!street) return "";
  const locality = [city, state].filter(Boolean).join(", ");
  if (locality && zip) return `${street}, ${locality} ${zip}`;
  if (locality) return `${street}, ${locality}`;
  if (zip) return `${street}, ${zip}`;
  return street;
}

const latIdx = header.indexOf("latitude");
const lngIdx = header.indexOf("longitude");
const hasCoords = latIdx >= 0 && lngIdx >= 0;

let outHeader;
if (hasCoords) {
  outHeader = header;
} else {
  outHeader = [...header, "latitude", "longitude"];
}

const outLines = [outHeader.map(escapeCsvField).join(",")];

let ok = 0;
let fail = 0;
for (let i = 1; i < lines.length; i++) {
  const row = parseCsvLine(lines[i]);
  const addr = rowFullAddress(row);
  let lat = "";
  let lng = "";

  if (hasCoords) {
    lat = row[latIdx] ?? "";
    lng = row[lngIdx] ?? "";
    if (lat !== "" && lng !== "" && !Number.isNaN(parseFloat(lat)) && !Number.isNaN(parseFloat(lng))) {
      outLines.push(row.map(escapeCsvField).join(","));
      ok++;
      continue;
    }
  }

  if (addr) {
    const r = await geocodeAddress(addr);
    if (r) {
      lat = String(r.lat);
      lng = String(r.lon);
      ok++;
    } else {
      fail++;
    }
  } else {
    fail++;
  }

  if (hasCoords) {
    const next = [...row];
    while (next.length < header.length) next.push("");
    next[latIdx] = lat;
    next[lngIdx] = lng;
    outLines.push(next.map(escapeCsvField).join(","));
  } else {
    outLines.push([...row, lat, lng].map(escapeCsvField).join(","));
  }

  if (i % 10 === 0) console.log(`  ${i}/${lines.length - 1}`);
  await sleep(1100);
}

writeFileSync(outPath, outLines.join("\n") + "\n", "utf-8");
console.log("Wrote", outPath, "geocoded:", ok, "failed:", fail);
