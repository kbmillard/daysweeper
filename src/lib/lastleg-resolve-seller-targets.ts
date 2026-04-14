import { prisma } from '@/lib/prisma';

/** Match MapPin / route merge convention (5 decimals). */
export function lastlegCoordKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function legacyCompanyId(legacyJson: unknown): string | null {
  if (!legacyJson || typeof legacyJson !== 'object') return null;
  const o = legacyJson as Record<string, unknown>;
  const v = o.companyId ?? o.company_id;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

type TargetLike = {
  id: string;
  /** Raw `Target.company` — used to avoid false seller match when coords collide. */
  company?: string;
  latitude?: unknown;
  longitude?: unknown;
  legacyJson?: unknown;
};

function coordMatchCompanyNameOk(targetCompany: string | undefined, sellerName: string): boolean {
  const a = (targetCompany ?? '').trim().toLowerCase();
  const b = sellerName.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return false;
}

/** Matches `target-to-lead` — generic / empty route names trust the coordinate match for seller overlay. */
function genericProspectTargetName(name: string | undefined): boolean {
  const t = (name ?? '').trim();
  if (!t) return true;
  return (
    /^prospect(\s+\d+)?$/i.test(t) ||
    /^pin(\s+\d+)?$/i.test(t) ||
    /^untitled placemark$/i.test(t)
  );
}

/**
 * For LastLeg leads: map target id → seller `Company.id` when the target aligns with a
 * non-hidden seller company — either `legacyJson.companyId` is that seller, or coordinates
 * match a geocoded seller `Location` (same coord key as web map merge).
 */
export async function resolveSellerCompanyIdsForTargets(
  targets: TargetLike[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (targets.length === 0) return out;

  const legacyIds = new Set<string>();
  for (const t of targets) {
    const cid = legacyCompanyId(t.legacyJson);
    if (cid) legacyIds.add(cid);
  }

  if (legacyIds.size > 0) {
    const rows = await prisma.company.findMany({
      where: { id: { in: [...legacyIds] }, isSeller: true, hidden: false },
      select: { id: true }
    });
    const sellerSet = new Set(rows.map((r) => r.id));
    for (const t of targets) {
      const cid = legacyCompanyId(t.legacyJson);
      if (cid && sellerSet.has(cid)) out.set(t.id, cid);
    }
  }

  const keySet = new Set<string>();
  for (const t of targets) {
    if (out.has(t.id)) continue;
    const lat = t.latitude != null ? Number(t.latitude) : null;
    const lng = t.longitude != null ? Number(t.longitude) : null;
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      keySet.add(lastlegCoordKey(lat, lng));
    }
  }

  if (keySet.size === 0) return out;

  const sellerLocs = await prisma.location.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
      Company: { isSeller: true, hidden: false }
    },
    select: {
      companyId: true,
      latitude: true,
      longitude: true,
      Company: { select: { name: true } }
    }
  });

  const byCoord = new Map<string, { companyId: string; name: string }>();
  for (const loc of sellerLocs) {
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const k = lastlegCoordKey(lat, lng);
    if (!keySet.has(k)) continue;
    const name = loc.Company?.name?.trim() ?? '';
    if (!byCoord.has(k)) byCoord.set(k, { companyId: loc.companyId, name });
  }

  for (const t of targets) {
    if (out.has(t.id)) continue;
    const lat = t.latitude != null ? Number(t.latitude) : null;
    const lng = t.longitude != null ? Number(t.longitude) : null;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const hit = byCoord.get(lastlegCoordKey(lat, lng));
    if (!hit) continue;
    const tc = typeof t.company === 'string' ? t.company : undefined;
    if (
      coordMatchCompanyNameOk(tc, hit.name) ||
      genericProspectTargetName(tc)
    ) {
      out.set(t.id, hit.companyId);
    }
  }

  return out;
}
