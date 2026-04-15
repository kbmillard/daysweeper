'use client';

import { parseDmsCoordinates } from '@/lib/geocode-address';
import { geocodeWithAppleMapKit, tryParseLatLng } from '@/lib/mapkit-geocode-client';

/**
 * Resolve a map / route search string to coordinates:
 * - `lat, lng` decimals (validated WGS84)
 * - Google Earth–style DMS, e.g. `34°12'02.18"N 80°41'26.46"W`
 * - When signed in: `POST /api/geocode` (same server normalization as CRM tools)
 * - Else: Apple MapKit forward geocode in the browser
 */
export async function resolveRouteWaypoint(address: string): Promise<{ lat: number; lng: number }> {
  const q = address.trim();
  if (!q) throw new Error('Empty search');
  const direct = tryParseLatLng(q);
  if (direct) return direct;
  const dms = parseDmsCoordinates(q);
  if (dms) return dms;
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ address: q }),
      });
      if (res.ok) {
        const j = (await res.json()) as { latitude?: unknown; longitude?: unknown };
        const lat = typeof j.latitude === 'number' ? j.latitude : Number(j.latitude);
        const lng = typeof j.longitude === 'number' ? j.longitude : Number(j.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { lat, lng };
        }
      }
    } catch {
      /* fall through to MapKit */
    }
  }
  return geocodeWithAppleMapKit(q);
}
