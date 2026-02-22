#!/usr/bin/env npx tsx
/**
 * Check Neon database row counts via REST API.
 * Uses DATABASE_URL from .env.local - extracts password for apikey.
 */

import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const REST_BASE = process.env.NEON_REST_URL ?? 'https://ep-morning-dew-ah8xi2jg.apirest.c-3.us-east-1.aws.neon.tech/neondb/rest/v1';
const DATABASE_URL = process.env.DATABASE_URL;

function getApiKey(): string | null {
  if (process.env.NEON_REST_API_KEY) return process.env.NEON_REST_API_KEY;
  if (!DATABASE_URL) return null;
  try {
    const u = new URL(DATABASE_URL.replace(/^postgresql:/, 'https:'));
    return u.password || null;
  } catch {
    return null;
  }
}

async function fetchCount(table: string): Promise<number> {
  const key = getApiKey();
  if (!key) throw new Error('No NEON_REST_API_KEY or DATABASE_URL password');

  const url = `${REST_BASE}/${table}?select=id`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'count=exact'
    }
  });

  const count = res.headers.get('content-range');
  if (count) {
    const m = count.match(/\/(\d+)$/);
    if (m) return parseInt(m[1], 10);
  }
  const json = await res.json();
  return Array.isArray(json) ? json.length : 0;
}

async function main() {
  const key = getApiKey();
  if (!key) {
    console.error('Need NEON_REST_API_KEY or DATABASE_URL with password in .env.local');
    process.exit(1);
  }

  const tables = ['Company', 'Location', 'Target', 'Route', 'RouteStop', 'WarehouseItem'];
  console.log('Neon REST:', REST_BASE);
  console.log('---');

  for (const t of tables) {
    try {
      const n = await fetchCount(t);
      console.log(`${t}: ${n}`);
    } catch (e) {
      console.log(`${t}: error`, e instanceof Error ? e.message : e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
