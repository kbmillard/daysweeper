#!/usr/bin/env node
/**
 * Rebuild the shared LastLeg route from the canonical visible MapPin set.
 *
 * - Uses all non-hidden MapPins as the only pins the iOS app should receive.
 * - Reuses existing Target rows by coordinate when possible.
 * - Creates missing Target rows for pins that are not yet on the route.
 * - Replaces the dedicated shared route stops on each run so app pins stay exact.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { isNeonDataTransferQuotaExceeded } from './lib/neon-quota.mjs';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!dbUrl) {
  console.log('No DATABASE_URL, skipping shared route sync');
  process.exit(0);
}

const SHARED_USER_ID = 'shared';
const ROUTE_NAME = 'LastLeg Canonical Pins';

function coordKey(lat, lng) {
  return `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
}

function asNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function genericProspectName(name) {
  return /^prospect(\s+\d+)?$/i.test(String(name || '').trim()) || /^pin$/i.test(String(name || '').trim());
}

const pool = new pg.Pool({ connectionString: dbUrl });
let client;
try {
  client = await pool.connect();
} catch (e) {
  if (isNeonDataTransferQuotaExceeded(e)) {
    console.warn(
      'sync-shared-route-to-mappins: Neon data transfer quota exceeded; skipping (upgrade Neon or run locally).'
    );
    await pool.end();
    process.exit(0);
  }
  throw e;
}

try {
  await client.query('BEGIN');

  const mapPinsRes = await client.query(
    `
      SELECT id, latitude, longitude, "createdAt"
      FROM "MapPin"
      WHERE hidden = false
      ORDER BY "createdAt" ASC, id ASC
    `
  );
  const mapPins = mapPinsRes.rows
    .map((row) => ({
      id: String(row.id),
      lat: asNumber(row.latitude),
      lng: asNumber(row.longitude)
    }))
    .filter((row) => row.lat != null && row.lng != null);

  if (!mapPins.length) {
    console.log('No visible MapPins found, skipping shared route sync');
    await client.query('ROLLBACK');
    process.exit(0);
  }

  const routeRes = await client.query(
    `
      SELECT id
      FROM "Route"
      WHERE "assignedToUserId" = $1 AND name = $2
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `,
    [SHARED_USER_ID, ROUTE_NAME]
  );

  const now = new Date();
  let routeId = routeRes.rows[0]?.id;
  if (!routeId) {
    routeId = randomUUID();
    await client.query(
      `
        INSERT INTO "Route" (
          id, name, "assignedToUserId", created, "updatedAt"
        ) VALUES ($1, $2, $3, $4, $4)
      `,
      [routeId, ROUTE_NAME, SHARED_USER_ID, now]
    );
  } else {
    await client.query('DELETE FROM "RouteStop" WHERE "routeId" = $1', [routeId]);
    await client.query('UPDATE "Route" SET "updatedAt" = $2 WHERE id = $1', [routeId, now]);
  }

  const existingTargetsRes = await client.query(
    `
      SELECT
        t.id,
        t.company,
        t.website,
        t.phone,
        t."addressRaw",
        t.latitude,
        t.longitude,
        te."enrichedJson"
      FROM "Target" t
      LEFT JOIN "TargetEnrichment" te ON te."targetId" = t.id
      WHERE t.latitude IS NOT NULL AND t.longitude IS NOT NULL
    `
  );

  const targetsByCoord = new Map();
  for (const row of existingTargetsRes.rows) {
    const lat = asNumber(row.latitude);
    const lng = asNumber(row.longitude);
    if (lat == null || lng == null) continue;
    const key = coordKey(lat, lng);
    const existing = targetsByCoord.get(key);
    const candidate = {
      id: String(row.id),
      company: String(row.company || ''),
      addressRaw: String(row.addressRaw || ''),
      website: row.website ? String(row.website) : null,
      phone: row.phone ? String(row.phone) : null,
      enrichedJson: row.enrichedJson && typeof row.enrichedJson === 'object' ? row.enrichedJson : null
    };

    if (!existing) {
      targetsByCoord.set(key, candidate);
      continue;
    }

    const existingScore = genericProspectName(existing.company) ? 0 : 1;
    const candidateScore = genericProspectName(candidate.company) ? 0 : 1;
    if (candidateScore > existingScore) {
      targetsByCoord.set(key, candidate);
    }
  }

  let reused = 0;
  let created = 0;
  let seq = 1;

  for (const pin of mapPins) {
    const key = coordKey(pin.lat, pin.lng);
    let target = targetsByCoord.get(key);

    if (!target) {
      const targetId = randomUUID();
      const addressRaw = `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`;
      await client.query(
        `
          INSERT INTO "Target" (
            id, company, "addressRaw", latitude, longitude, "geocodeStatus", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, 'geocoded', $6, $6)
        `,
        [targetId, 'Prospect', addressRaw, pin.lat, pin.lng, now]
      );
      target = { id: targetId };
      created += 1;
    } else {
      reused += 1;
    }

    await client.query(
      `
        INSERT INTO "RouteStop" (
          id, "routeId", "targetId", seq, "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $5)
      `,
      [randomUUID(), routeId, target.id, seq, now]
    );
    seq += 1;
  }

  await client.query('COMMIT');
  console.log('Shared route sync complete');
  console.log('Visible MapPins:', mapPins.length);
  console.log('Route stops written:', seq - 1);
  console.log('Targets reused:', reused);
  console.log('Targets created:', created);
} catch (e) {
  try {
    await client.query('ROLLBACK');
  } catch {
    /* ignore */
  }
  if (isNeonDataTransferQuotaExceeded(e)) {
    console.warn(
      'sync-shared-route-to-mappins: Neon data transfer quota exceeded; skipping (upgrade Neon or run locally).'
    );
  } else {
    console.error('sync-shared-route-to-mappins failed:', e?.message || e);
    process.exitCode = 1;
  }
} finally {
  client.release();
  await pool.end();
}
