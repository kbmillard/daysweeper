#!/usr/bin/env node
/**
 * Dedupe a pasted business list against atlanta_no_website CSV, then geocode new rows.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const REF = join(
  "/Users/kyle/Downloads",
  "atlanta_no_website_businesses_geocode_combined_pass2 (3).csv"
);
const OUT = join("/Users/kyle/Downloads", "atlanta_yelp_manual_deduped_geocoded.csv");

const RAW = `
Carol and Betty's Salon – 401 Memorial Dr, Ste K, Atlanta, GA 30312 | (404) 386-2429
Hair Loft Atlanta – 898 Oak St SW, Ste C, Atlanta, GA 30310 | (404) 274-0653
Charlie's Angels Hair Salon – 5725 Old National Hwy, Ste 1, Atlanta, GA 30349
Cortex Hair Studio – 1177 Virginia Ave NE, Atlanta, GA 30306 | (404) 874-6913
Hair By Resa – Atlanta, GA 30318 | (470) 872-3750
Hair by Rita – Atlanta, GA 30331 | (478) 772-7001
Chells Beauty Bar – 1512 Piedmont Ave NE, Atlanta, GA
Stacy G Studios – 659 Auburn Ave NE, Ste 113, Atlanta, GA 30312 | (678) 974-5139
Raj Beauty Bar – Atlanta, GA (Mobile/Placeholder)
Blossom & Bloom Salon – 1151 Hammond Dr, Unit 200, Ste 131, Atlanta, GA 30346 | (470) 398-6133
Braids Galore and Salon – 2100 Candler Rd, Decatur, GA 30032 | (404) 941-7110
BB Salon – 2227 College Ave, Atlanta, GA 30317
W Roy Salon – 2700 E College Ave, Ste 1000, Decatur, GA 30030 | (404) 748-4067
C Luxestudios – Atlanta area (Multiple locations, listed as placeholder)
Egyptian Hair Styles – 2.8 mi from Atlanta center (Placeholder)
Salon Ajee – 2.6 mi from Atlanta center (Placeholder)
Milly's Dominican Hair Salon – 2.6 mi from Atlanta center (Placeholder)
In the Mix Hair Salon – 4.9 mi from Atlanta center (Placeholder)
Touched by an Angel Salon – 3.7 mi from Atlanta center (Placeholder)
Vivid Hair Salon – 1.9 mi from Atlanta center (Placeholder)
Yelp
Yelp
 +10
Nail Salons
Beauty Nail Salon – 589 Cascade Ave SW, Atlanta, GA 30310 | (404) 758-9394
Glambox Room – 1210 Fowler St NW, Atlanta, GA 30318
Morningside Nail Bar – 1845 Piedmont Ave NE, Ste 200, Atlanta, GA 30324
The Nail Lab Buckhead – 360 Pharr Rd NE, Ste 103, Atlanta, GA 30305
Unique Nails – 2.4 mi from Atlanta center (Placeholder)
Angel Nails – 0.6 mi from Atlanta center (Placeholder)
Star Nails – 5.7 mi from Atlanta center (Placeholder)
Nail Spa – 5.9 mi from Atlanta center (Placeholder)
All Star Nail – 2.9 mi from Atlanta center (Placeholder)
Hammond Nails Of Sandy Springs – 7.2 mi from Atlanta center (Placeholder)
Kandi Toes Mobile Nail Spa – Stone Mountain, GA 30088 (Mobile Service)
Yelp
Yelp
 +3
💈 Barber Shops
Piedmont Barbers – 2350 Cheshire Bridge Rd, Ste 202, Atlanta, GA 30324 | (404) 248-9999
Vista Barbershop – 1656 Lavista Rd NE, Atlanta, GA 30329 | (404) 235-7335
Legends Barber & Accessory Shop – 76 Upper Alabama St SW, Atlanta, GA 30303
Enzo's Barber Grooming – 451 Bishop St NW, Atlanta, GA 30318
JayBo Da Barber – 1893 Cheshire Bridge Rd NE, Atlanta, GA 30324
Knoxinfades – 3640 Campbellton Rd SW, Atlanta, GA 30331
I Rock With Ray Moore – 1893 Cheshire Bridge Rd NE, Atlanta, GA 30324
X Da Barber – 1465 Chattahoochee Ave NW, Unit 500, Atlanta, GA 30318
Jerrythe.barber – 1465 Chattahoochee Ave NW #500, Atlanta, GA 30318
R3LL KUTZ – 1199 Huff Rd NW, Unit 115, Atlanta, GA 30318
Booksy
Booksy
 +6
`;

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
    .replace(/,?\s*Ste\.?\s*\w+/gi, "")
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
    headers: { "User-Agent": "daysweeper-yelp-dedupe/1.0" },
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
    headers: { "User-Agent": "daysweeper-yelp-dedupe/1.0" },
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
  return (
    r &&
    typeof r.lat === "number" &&
    typeof r.lon === "number" &&
    !Number.isNaN(r.lat) &&
    !Number.isNaN(r.lon)
  );
}

function geocodeCandidates(addressRaw) {
  const a = addressRaw.trim();
  const out = [];
  if (/^Atlanta, GA \d{5}$/i.test(a)) {
    out.push(`${a.match(/\d{5}/)[0]}, Atlanta, GA, USA`);
  }
  if (/Hammond Dr/i.test(a) && /30346/.test(a) && /Atlanta/i.test(a)) {
    out.push(a.replace(/, Atlanta, GA 30346/i, ", Sandy Springs, GA 30346"));
  }
  out.push(a);
  if (/Old National Hwy/i.test(a) && /30349/.test(a) && /Atlanta/i.test(a)) {
    out.push(a.replace(/, Atlanta, GA/i, ", College Park, GA"));
  }
  if (/1893\s+Cheshire/i.test(a)) {
    out.push("1893 Cheshire Bridge Road Northeast, Atlanta, GA 30324, USA");
  }
  if (/76\s+Upper\s+Alabama/i.test(a)) {
    out.push("76 Upper Alabama Street Southwest, Atlanta, GA 30303, USA");
  }
  return [...new Set(out)];
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

/** Strip suite/unit for matching same building. */
function addrDedupeKey(addr) {
  if (!addr) return "";
  let s = addr
    .toLowerCase()
    .replace(/#\s*\d+/gi, " ")
    .replace(/\b(ste|suite|unit)\b\.?\s*[\w-]+/gi, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const zip = (addr.match(/\b(\d{5})(?:-\d{4})?\b/) || [])[1] || "";
  const num = (s.match(/^(\d+)/) || [])[1] || "";
  const rest = s.replace(/^\d+\s+/, "").split(/\s+/).slice(0, 6).join(" ");
  return `${zip}|${num}|${rest}`;
}

function loadReferenceKeys(refPath) {
  const raw = readFileSync(refPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const header = parseCsvLine(lines[0]);
  const fullIdx = header.indexOf("full_address");
  const addrKeys = new Set();
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const full = row[fullIdx] || "";
    if (full) addrKeys.add(addrDedupeKey(full));
  }
  return { addrKeys };
}

function parseManualLine(line) {
  const t = line.trim();
  if (!t) return null;
  if (/^(yelp|booksy|\+?\d+)$/i.test(t)) return { skip: true, reason: "noise" };
  if (/^\+\d+$/.test(t)) return { skip: true, reason: "noise" };
  if (/^[\s💈🎨]+(barber|nail|salon)/i.test(t)) return { skip: true, reason: "section" };
  if (/placeholder|mi from atlanta|multiple locations/i.test(t))
    return { skip: true, reason: "placeholder" };
  if (/mobile\/placeholder/i.test(t)) return { skip: true, reason: "placeholder" };

  let name;
  let rest;
  const seps = [" – ", " — ", " - "];
  let found = false;
  for (const sep of seps) {
    const i = t.indexOf(sep);
    if (i >= 0) {
      name = t.slice(0, i).trim();
      rest = t.slice(i + sep.length).trim();
      found = true;
      break;
    }
  }
  if (!found || !name || !rest) return { skip: true, reason: "unparsed" };
  const phoneMatch = line.match(/\((\d{3})\)\s*(\d{3}-\d{4})/);
  const phone = phoneMatch ? phoneMatch[0] : "";
  rest = rest.split(/\s*\|\s*/)[0].trim();

  if (!rest || /placeholder/i.test(rest)) return { skip: true, reason: "placeholder" };

  let fullAddress = rest;
  if (/\(Mobile Service\)/i.test(rest)) {
    fullAddress = rest.replace(/\s*\(Mobile Service\)\s*/i, "").trim();
  }

  const hasStreetNum = /^\d+\s/.test(fullAddress) || /,\s*\d+\s/.test(fullAddress);
  const hasZip = /\b\d{5}\b/.test(fullAddress);
  if (!hasStreetNum && !hasZip) return { skip: true, reason: "no_address" };

  if (!hasZip && hasStreetNum) {
    if (!/\b(Atlanta|Decatur|College Park|East Point|Smyrna|Marietta|Stone Mountain)\b/i.test(fullAddress)) {
      fullAddress = `${fullAddress}, Atlanta, GA`;
    }
  }

  return { name, fullAddress, phone };
}

async function main() {
  const { addrKeys } = loadReferenceKeys(REF);

  const seenAddr = new Set();
  const rows = [];
  const dupes = [];
  const skipped = [];

  for (const line of RAW.split("\n")) {
    const parsed = parseManualLine(line);
    if (!parsed) continue;
    if (parsed.skip) {
      skipped.push({ line: line.trim(), reason: parsed.reason });
      continue;
    }

    const { name, fullAddress, phone } = parsed;
    const key = addrDedupeKey(fullAddress);

    if (addrKeys.has(key)) {
      dupes.push({ name, fullAddress, match: "csv_address" });
      continue;
    }
    if (seenAddr.has(key)) {
      dupes.push({ name, fullAddress, match: "duplicate_in_list" });
      continue;
    }
    seenAddr.add(key);

    rows.push({ name, fullAddress, phone });
  }

  console.log("New to geocode:", rows.length);
  console.log("Deduped (CSV or in-list):", dupes.length);
  console.log("Skipped:", skipped.filter((s) => s.reason !== "noise").length);

  const outLines = [
    ["business_name", "full_address", "phone", "dedupe_note", "latitude", "longitude"]
      .map(escapeCsvField)
      .join(","),
  ];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    let g = null;
    for (const q of geocodeCandidates(r.fullAddress)) {
      g = await geocodeAddress(q);
      if (g) break;
      await sleep(1100);
    }
    const lat = g ? String(g.lat) : "";
    const lng = g ? String(g.lon) : "";
    outLines.push(
      [r.name, r.fullAddress, r.phone || "", "", lat, lng].map(escapeCsvField).join(",")
    );
    if ((i + 1) % 5 === 0) console.log(`  ${i + 1}/${rows.length}`);
    await sleep(1100);
  }

  for (const d of dupes) {
    outLines.push(
      [d.name, d.fullAddress, "", `deduped:${d.match}`, "", ""].map(escapeCsvField).join(",")
    );
  }

  writeFileSync(OUT, outLines.join("\n") + "\n", "utf-8");
  console.log("Wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
