#!/usr/bin/env node
/**
 * Parse JSON/round2/Dots.kml, dedupe coordinates (5 decimals), write lat/long CSV.
 * Run: node scripts/dots-to-csv.mjs
 * Output: JSON/round2/Dots.csv (or pass path as first arg)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const kmlPath = path.join(root, 'JSON', 'round2', 'Dots.kml');
const outPath = process.argv[2] || path.join(root, 'JSON', 'round2', 'Dots.csv');

function key(lng, lat) {
  return `${Number(lng.toFixed(5))},${Number(lat.toFixed(5))}`;
}

if (!fs.existsSync(kmlPath)) {
  console.error('Not found:', kmlPath);
  process.exit(1);
}

const content = fs.readFileSync(kmlPath, 'utf-8');
const coordRegex = /<coordinates>\s*([^<]+)<\/coordinates>/g;
const MAX_LOCATIONS = 1600;
const seen = new Set();
const rows = [];
let m;
while ((m = coordRegex.exec(content)) !== null && rows.length < MAX_LOCATIONS) {
  const parts = m[1].trim().split(/[\s,]+/);
  const lng = parseFloat(parts[0]);
  const lat = parseFloat(parts[1]);
  if (Number.isNaN(lng) || Number.isNaN(lat)) continue;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
  const k = key(lng, lat);
  if (seen.has(k)) continue;
  seen.add(k);
  rows.push([lat, lng]);
}

const csvHeader = 'lat,long';
const csvBody = rows.map(([lat, lng]) => `${lat},${lng}`).join('\n');
const csv = csvHeader + '\n' + csvBody;

const outDir = path.dirname(outPath);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, csv, 'utf-8');
console.log('Wrote', outPath, 'with', rows.length, 'rows (deduped, max', MAX_LOCATIONS, ').');
