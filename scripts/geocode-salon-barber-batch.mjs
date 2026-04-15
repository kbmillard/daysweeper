#!/usr/bin/env node
/**
 * Parse salon/barber bullet list, dedupe vs combined CSV, geocode (Nominatim + geocode.xyz).
 */
import { readFileSync, writeFileSync } from "fs";

const REF = "/Users/kyle/Downloads/atlanta_no_website_businesses_geocode_combined_pass2 (3).csv";
const OUT = "/Users/kyle/Downloads/atlanta_salons_barbers_list_geocoded.csv";

const RAW = `
* Carol and Betty's Salon: 401 Memorial Dr SE, Ste K, Atlanta, GA 30312
* Hair Loft Atlanta: 898 Oak St SW, Ste C, Atlanta, GA 30310
* Charlie's Angels Hair Salon: 5725 Old National Hwy, Ste 1, Atlanta, GA 30349
* Cortex Hair Studio: 1177 Virginia Ave NE, Atlanta, GA 30306
* Chells Beauty Bar: 1512 Piedmont Ave NE, Atlanta, GA 30324
* Stacy G Studios: 659 Auburn Ave NE, Ste 113, Atlanta, GA 30312
* Blossom & Bloom Salon: 1151 Hammond Dr, Ste 131, Atlanta, GA 30346
* Braids Galore and Salon: 2100 Candler Rd, Decatur, GA 30032
* BB Salon: 2227 College Ave NE, Atlanta, GA 30317
* W Roy Salon: 2700 E College Ave, Ste 1000, Decatur, GA 30030
* Beauty Nail Salon: 589 Cascade Ave SW, Atlanta, GA 30310
* Glambox Room: 1210 Fowler St NW, Atlanta, GA 30318
* Morningside Nail Bar: 1845 Piedmont Ave NE, Ste 200, Atlanta, GA 30324
* The Nail Lab Buckhead: 360 Pharr Rd NE, Ste 103, Atlanta, GA 30305

## 💈 Barber Shops (Part 1)
------------------------------

* Thomas Barber Shop: 1268 W Paces Ferry Rd NW, Atlanta, GA 30327
* Peachtree Battle Barber Shop: 2335 Peachtree Rd NE, Atlanta, GA 30305
* Terrace Barber Shop: 3167 Peachtree Rd NE, Atlanta, GA 30305
* Legends Barber & Accessory Shop: 76 Upper Alabama St SW, Atlanta, GA 30303
* VINTAGE The BARBER SHOP: 55 Forsyth St NW, Atlanta, GA 30303
* JayBo Da Barber: 1893 Cheshire Bridge Rd NE, Atlanta, GA 30324
* I Rock With Ray Moore: 1893 Cheshire Bridge Rd NE, Atlanta, GA 30324
* Knoxinfades: 3640 Campbellton Rd SW, Atlanta, GA 30331
* Barber Icon Mr. Perfect: 83 Walton St NW, Atlanta, GA 30303
* Tre Aubrey: 200 Bennett St NW, Atlanta, GA 30309
* Jerrythe.barber: 1465 Chattahoochee Ave NW #500, Atlanta, GA 30318
* X Da Barber: 1465 Chattahoochee Ave NW #500, Atlanta, GA 30318
* Marcus Da Blender: 1210 Fowler ST NW, Atlanta, GA 30318
* Moneycuts: 365 14th Street NW, Suite 102, Atlanta, GA 30318
* A-Jamal Nuruddin: 1659 Defoor Ave NW, Atlanta, GA 30318
* R3LL KUTZ: 1199 Huff Rd NW, Unit 115, Atlanta, GA 30318
* Flyguy: 1000 Northside Dr NW, Atlanta, GA 30318
* Cam Kutz: 1000 Northside Dr NW, Atlanta, GA 30318

## 💈 Barber Shops (Part 2)
------------------------------

* Jefè Da Barber: 1000 Northside Dr NW, Atlanta, GA 30318
* Fade Factory ATL: 1000 Northside Dr NW #206, Atlanta, GA 30318
* On Pointe Barbershop: 1003 Forest Pkwy, Forest Park, GA 30297
* Solo's Barbershop LLC: 559 Forest Pkwy Suite B, Forest Park, GA 30297
* IN THE CUT 2 SALON: 819 Forest Pkwy, Forest Park, GA 30297
* Legit Cuts: 4695 Jonesboro Rd, Forest Park, GA 30297
* Pheonixx Fades: 4841 Jonesboro Rd, Forest Park, GA 30297
* Salón de belleza nueva imagen # 2: 6065 Old Dixie Hwy, Forest Park, GA 30297
* Sages Barbershop: 2879 E Point St, East Point, GA 30344
* The Musa Lair: 2835 R N Martin St, Ste 123 East Point, GA 30344
* Virginia Highlands Barbershop: 794 N Highland Ave NE, Atlanta, GA 30306
* Vista Barbershop: 1656 Lavista Rd NE, Atlanta, GA 30329
* Piedmont Barbers: 2350 Cheshire Bridge Rd, Ste 202 Atlanta, GA 30324
* Vinings Barber: 2810 Paces Ferry Rd SE, Ste 108 Atlanta, GA 30339
* Lamont's Barbershop Grooming Lounge: 2955 Cobb Pkwy SE, Ste 301 Atlanta, GA 30339
* Enzo's Barber Grooming: 451 Bishop St NW, Atlanta, GA 30318
* The Cut Parlor: 1133 Huff Rd NW, Atlanta, GA 30318
* Proper Grooming Co: 1133 Huff Rd NW, Atlanta, GA 30318
`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fixAddressCommas(addr) {
  let s = addr.trim();
  s = s.replace(/(Ste|Suite)\s+(\d+)\s+East Point\b/gi, "$1 $2, East Point");
  s = s.replace(/(Ste|Suite)\s+([^,]+?)\s+(Atlanta|Decatur|Forest Park|East Point)\b/gi, "$1 $2, $3");
  return s;
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
    headers: { "User-Agent": "daysweeper-salon-barber-batch/1.0" },
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
    headers: { "User-Agent": "daysweeper-salon-barber-batch/1.0" },
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
    out.unshift("1893 Cheshire Bridge Road, Atlanta, GA 30324, USA");
    out.push("1893 Cheshire Bridge Road Northeast, Atlanta, GA 30324, USA");
  }
  if (/2835\s+R\s+N\s+Martin/i.test(a) || /2835.*Martin.*East Point/i.test(a)) {
    out.push("2835 South Martin Street, East Point, GA 30344, USA");
  }
  if (/2955\s+Cobb\s+Pkwy/i.test(a) && /30339/.test(a)) {
    out.push("2955 Cobb Parkway Southeast, Vinings, GA 30339, USA");
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

function loadReferenceCoords(refPath) {
  const raw = readFileSync(refPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const header = parseCsvLine(lines[0]);
  const fullIdx = header.indexOf("full_address");
  const latIdx = header.indexOf("latitude");
  const lngIdx = header.indexOf("longitude");
  const nameIdx = header.indexOf("business_name");
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const full = row[fullIdx] || "";
    const lat = row[latIdx];
    const lng = row[lngIdx];
    if (!full || !lat || !lng) continue;
    const k = addrDedupeKey(full);
    if (!map.has(k))
      map.set(k, { lat, lng, name: row[nameIdx] || "" });
  }
  return map;
}

function parseBulletLines(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || /^-+$/.test(t)) continue;
    const m = t.match(/^\*\s*(.+?):\s*(.+)$/);
    if (!m) continue;
    const name = m[1].trim();
    let addr = fixAddressCommas(m[2].trim());
    rows.push({ name, fullAddress: addr });
  }
  return rows;
}

async function main() {
  const refCoords = loadReferenceCoords(REF);
  const parsed = parseBulletLines(RAW);
  const seen = new Map();
  const outRows = [];

  for (const { name, fullAddress } of parsed) {
    const key = addrDedupeKey(fullAddress);
    let note = "";
    let lat = "";
    let lng = "";

    if (refCoords.has(key)) {
      const r = refCoords.get(key);
      lat = r.lat;
      lng = r.lng;
      note = `matched_csv:${r.name}`;
      seen.set(key, { lat, lng });
    } else if (seen.has(key)) {
      const prev = seen.get(key);
      lat = prev.lat;
      lng = prev.lng;
      note = "duplicate_address_in_list";
    } else {
      let g = null;
      for (const q of geocodeCandidates(fullAddress)) {
        g = await geocodeAddress(q);
        if (g) break;
        await sleep(1100);
      }
      if (g) {
        lat = String(g.lat);
        lng = String(g.lon);
        seen.set(key, { lat, lng });
      }
      await sleep(1100);
    }

    outRows.push({ name, fullAddress, latitude: lat, longitude: lng, note });
  }

  const header = ["business_name", "full_address", "latitude", "longitude", "note"];
  const lines = [header.map(escapeCsvField).join(",")];
  for (const r of outRows) {
    lines.push(
      [r.name, r.fullAddress, r.latitude, r.longitude, r.note].map(escapeCsvField).join(",")
    );
  }
  writeFileSync(OUT, lines.join("\n") + "\n", "utf-8");
  console.log("Wrote", OUT, "rows:", outRows.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
