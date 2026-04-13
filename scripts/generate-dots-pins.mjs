#!/usr/bin/env node
/**
 * Build public/dots-pins.json.
 *
 * Source priority:
 * 1. docs/Dots.kml (manual verified pin source)
 * 2. JSON/round2/Dots.csv (legacy fallback)
 *
 * Run: node scripts/generate-dots-pins.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const kmlPath = path.join(root, 'docs', 'Dots.kml');
const csvPath = path.join(root, 'JSON', 'round2', 'Dots.csv');
const outPath = path.join(root, 'public', 'dots-pins.json');

function key(lat, lng) {
  return `${Number(lat.toFixed(6))},${Number(lng.toFixed(6))}`;
}

function parseKmlPins(xml) {
  const parts = xml.split(/<Placemark\b[^>]*>/);
  const seen = new Set();
  const pins = [];

  for (let i = 1; i < parts.length; i++) {
    const block = parts[i].split('</Placemark>')[0];
    const vis = block.match(/<visibility>\s*(\d+)\s*<\/visibility>/);
    if (vis && vis[1] === '0') continue;

    const coordMatch = block.match(/<coordinates>\s*([^<]+)\s*<\/coordinates>/);
    if (!coordMatch) continue;
    const nums = coordMatch[1].trim().split(/[\s,]+/).filter(Boolean);
    const lng = parseFloat(nums[0]);
    const lat = parseFloat(nums[1]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

    const k = key(lat, lng);
    if (seen.has(k)) continue;
    seen.add(k);
    pins.push({ lng, lat });
  }

  return pins;
}

function parseCsvPins(csv) {
  const rows = csv
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.trim().length > 0);
  const seen = new Set();
  const pins = [];

  for (const row of rows) {
    const [latRaw, lngRaw] = row.split(',');
    const lat = parseFloat(latRaw);
    const lng = parseFloat(lngRaw);
    if (Number.isNaN(lng) || Number.isNaN(lat)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

    const k = key(lat, lng);
    if (seen.has(k)) continue;
    seen.add(k);
    pins.push({ lng, lat });
  }

  return pins;
}

const publicDir = path.join(root, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

let pins = [];
let source = 'empty';

if (fs.existsSync(kmlPath)) {
  pins = parseKmlPins(fs.readFileSync(kmlPath, 'utf-8'));
  source = 'docs/Dots.kml';
} else if (fs.existsSync(csvPath)) {
  pins = parseCsvPins(fs.readFileSync(csvPath, 'utf-8'));
  source = 'JSON/round2/Dots.csv';
} else {
  console.warn(
    'No Dots source found at',
    kmlPath,
    'or',
    csvPath,
    '- writing empty pins.'
  );
}

fs.writeFileSync(outPath, JSON.stringify({ pins }, null, 0), 'utf-8');
console.log('Wrote', outPath, 'with', pins.length, 'pins from', source + '.');
