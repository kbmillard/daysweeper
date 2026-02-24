#!/usr/bin/env node
/**
 * Parse JSON/round2/Dots.kml, dedupe coordinates (5 decimals), write public/dots-pins.json.
 * Run: node scripts/generate-dots-pins.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const kmlPath = path.join(root, 'JSON', 'round2', 'Dots.kml');
const outPath = path.join(root, 'public', 'dots-pins.json');

function key(lng, lat) {
  return `${Number(lng.toFixed(5))},${Number(lat.toFixed(5))}`;
}

const publicDir = path.join(root, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

const MAX_LOCATIONS = 1600;
let pins = [];
if (fs.existsSync(kmlPath)) {
  const content = fs.readFileSync(kmlPath, 'utf-8');
  const coordRegex = /<coordinates>\s*([^<]+)<\/coordinates>/g;
  const seen = new Set();
  let m;
  while ((m = coordRegex.exec(content)) !== null && pins.length < MAX_LOCATIONS) {
    const parts = m[1].trim().split(/[\s,]+/);
    const lng = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    if (Number.isNaN(lng) || Number.isNaN(lat)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    const k = key(lng, lat);
    if (seen.has(k)) continue;
    seen.add(k);
    pins.push({ lng, lat });
  }
} else {
  console.warn('Dots.kml not found at', kmlPath, '- writing empty pins. Commit JSON/round2/Dots.kml to get red dots on the map.');
}

fs.writeFileSync(outPath, JSON.stringify({ pins }, null, 0), 'utf-8');
console.log('Wrote', outPath, 'with', pins.length, 'pins (deduped, max', MAX_LOCATIONS, ').');
