'use client';

import { parseDmsCoordinates } from '@/lib/geocode-address';
import { geocodeWithAppleMapKit, tryParseLatLng } from '@/lib/mapkit-geocode-client';

/**
 * Resolve a map / route search string to coordinates:
 * - `lat, lng` decimals (validated WGS84)
 * - Google Earth–style DMS, e.g. `34°12'02.18"N 80°41'26.46"W`
 * - Apple MapKit forward geocode only (no Google Geocoder — billing)
 */
export async function resolveRouteWaypoint(address: string): Promise<{ lat: number; lng: number }> {
  const q = address.trim();
  if (!q) throw new Error('Empty search');
  const direct = tryParseLatLng(q);
  if (direct) return direct;
  const dms = parseDmsCoordinates(q);
  if (dms) return dms;
  return geocodeWithAppleMapKit(q);
}
