#!/usr/bin/env node
/**
 * Runs DB prep + dots pins + MapPin sync + route tables before `next build`.
 * Keeps vercel.json buildCommand under Vercel's 256-char limit.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;

const scripts = [
  'scripts/ensure-primary-location-column.mjs',
  'scripts/ensure-map-pin-tables.mjs',
  'scripts/ensure-route-tables.mjs',
  'scripts/generate-dots-pins.mjs',
  'scripts/sync-mappins-from-dots-json.mjs',
  'scripts/prune-orphan-targets-and-hidden-dots.mjs',
  'scripts/sync-shared-route-to-mappins.mjs'
];

for (const rel of scripts) {
  const r = spawnSync(node, [path.join(root, rel)], {
    cwd: root,
    stdio: 'inherit'
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
