#!/usr/bin/env node
/**
 * Removes Target rows that do not correspond to a visible MapPin (stale KML / hidden pins),
 * dedupes geocoded targets at the same coordinate (keeps canonical route target when present),
 * clears HiddenDot (legacy hide list), and removes hidden MapPin rows.
 *
 * Run after sync-mappins-from-dots-json, before sync-shared-route-to-mappins.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { join } from 'path';
import { isNeonDataTransferQuotaExceeded } from './lib/neon-quota.mjs';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!dbUrl) {
  console.log('No DATABASE_URL, skipping prune');
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
    console.warn('prune-orphan-targets: Neon quota; skipping.');
    await pool.end();
    process.exit(0);
  }
  throw e;
}

try {
  await client.query('BEGIN');

  const mapPinsRes = await client.query(
    `SELECT latitude, longitude FROM "MapPin" WHERE hidden = false`
  );
  const allowed = new Set();
  for (const row of mapPinsRes.rows) {
    const lat = asNumber(row.latitude);
    const lng = asNumber(row.longitude);
    if (lat == null || lng == null) continue;
    allowed.add(coordKey(lat, lng));
  }

  const targetsRes = await client.query(`
    SELECT id, company, latitude, longitude
    FROM "Target"
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
  `);

  const routeRes = await client.query(
    `
    SELECT id FROM "Route"
    WHERE "assignedToUserId" = $1 AND name = $2
    ORDER BY "updatedAt" DESC
    LIMIT 1
    `,
    [SHARED_USER_ID, ROUTE_NAME]
  );
  const sharedRouteId = routeRes.rows[0]?.id ?? null;

  let sharedTargetIds = new Set();
  if (sharedRouteId) {
    const st = await client.query(
      `SELECT "targetId" FROM "RouteStop" WHERE "routeId" = $1`,
      [sharedRouteId]
    );
    sharedTargetIds = new Set(st.rows.map((r) => String(r.targetId)));
  }

  /** coordKey -> target rows */
  const byCoord = new Map();
  for (const row of targetsRes.rows) {
    const lat = asNumber(row.latitude);
    const lng = asNumber(row.longitude);
    if (lat == null || lng == null) continue;
    const key = coordKey(lat, lng);
    const list = byCoord.get(key) ?? [];
    list.push({
      id: String(row.id),
      company: String(row.company || '')
    });
    byCoord.set(key, list);
  }

  const toDelete = new Set();

  for (const [key, list] of byCoord) {
    if (!allowed.has(key)) {
      for (const t of list) toDelete.add(t.id);
      continue;
    }
    if (list.length <= 1) continue;

    let blocked = false;
    for (const t of list) {
      const ext = await client.query(
        `
        SELECT COUNT(*)::int AS c
        FROM "RouteStop" rs
        JOIN "Route" r ON r.id = rs."routeId"
        WHERE rs."targetId" = $1
          AND NOT (r."assignedToUserId" = $2 AND r.name = $3)
        `,
        [t.id, SHARED_USER_ID, ROUTE_NAME]
      );
      if ((ext.rows[0]?.c ?? 0) > 0) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    let keeper = null;
    for (const t of list) {
      if (sharedTargetIds.has(t.id)) {
        keeper = t.id;
        break;
      }
    }
    if (!keeper) {
      let best = list[0];
      let bestScore = genericProspectName(best.company) ? 0 : 1;
      for (const t of list.slice(1)) {
        const sc = genericProspectName(t.company) ? 0 : 1;
        if (sc > bestScore) {
          best = t;
          bestScore = sc;
        } else if (sc === bestScore && t.id < best.id) {
          best = t;
        }
      }
      keeper = best.id;
    }

    for (const t of list) {
      if (t.id !== keeper) toDelete.add(t.id);
    }
  }

  const doomed = [...toDelete];
  if (doomed.length) {
    await client.query(
      `UPDATE "Meeting" SET "targetId" = NULL WHERE "targetId" = ANY($1::text[])`,
      [doomed]
    );
    await client.query(`DELETE FROM "Target" WHERE id = ANY($1::text[])`, [doomed]);
  }

  let hiddenDots = 0;
  try {
    const hd = await client.query(`DELETE FROM "HiddenDot" RETURNING id`);
    hiddenDots = hd.rowCount ?? 0;
  } catch {
    /* table missing */
  }

  let hiddenPins = 0;
  try {
    const hp = await client.query(`DELETE FROM "MapPin" WHERE hidden = true RETURNING id`);
    hiddenPins = hp.rowCount ?? 0;
  } catch {
    /* column missing */
  }

  await client.query('COMMIT');
  console.log('prune-orphan-targets: deleted targets', doomed.length);
  console.log('prune-orphan-targets: deleted HiddenDot rows', hiddenDots);
  console.log('prune-orphan-targets: deleted hidden MapPin rows', hiddenPins);
} catch (e) {
  try {
    await client.query('ROLLBACK');
  } catch {
    /* ignore */
  }
  if (isNeonDataTransferQuotaExceeded(e)) {
    console.warn('prune-orphan-targets: Neon quota; skipping.');
  } else {
    console.error('prune-orphan-targets failed:', e?.message || e);
    process.exitCode = 1;
  }
} finally {
  client.release();
  await pool.end();
}
