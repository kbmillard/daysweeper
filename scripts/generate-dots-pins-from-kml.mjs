#!/usr/bin/env node
/**
 * Build public/dots-pins.json from docs/Dots.kml:
 * - Skip placemarks with <visibility>0</visibility> (hidden in Google Earth)
 * - Dedupe lat/lng at 6 decimals (same as generate-dots-pins.mjs / CSV flow)
 *
 * Run: node scripts/generate-dots-pins-from-kml.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const kmlPath = path.join(root, 'docs', 'Dots.kml');
const outPath = path.join(root, 'public', 'dots-pins.json');

function key(lat, lng) {
  return `${Number(lat.toFixed(6))},${Number(lng.toFixed(6))}`;
}

if (!fs.existsSync(kmlPath)) {
  console.error('Missing', kmlPath);
  process.exit(1);
}

const xml = fs.readFileSync(kmlPath, 'utf8');
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

const publicDir = path.join(root, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

fs.writeFileSync(outPath, JSON.stringify({ pins }, null, 0), 'utf-8');
console.log('Wrote', outPath, 'with', pins.length, 'pins (unhidden KML, deduped).');
