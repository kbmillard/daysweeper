'use client';

import { parseDmsCoordinates } from '@/lib/geocode-address';
import { geocodeWithAppleMapKit, tryParseLatLng } from '@/lib/mapkit-geocode-client';
import { loadGoogleMaps } from '@/lib/google-maps-loader';

/**
 * Resolve a map / route search string to coordinates:
 * - `lat, lng` decimals
 * - Google Earth–style DMS, e.g. `34°12'02.18"N 80°41'26.46"W`
 * - Apple MapKit forward geocode (when configured)
 * - Google Maps JavaScript Geocoder fallback (same as Google Maps on the page)
 */
export async function resolveRouteWaypoint(address: string): Promise<{ lat: number; lng: number }> {
  const q = address.trim();
  if (!q) throw new Error('Empty search');
  const direct = tryParseLatLng(q);
  if (direct) return direct;
  const dms = parseDmsCoordinates(q);
  if (dms) return dms;
  try {
    return await geocodeWithAppleMapKit(q);
  } catch {
    const g = await loadGoogleMaps();
    return await new Promise((resolve, reject) => {
      const geocoder = new g.maps.Geocoder();
      geocoder.geocode({ address: q }, (results, status) => {
        if (status === 'OK' && results?.[0]?.geometry?.location) {
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng() });
          return;
        }
        reject(
          new Error(
            `Address not found (${status}). Try a street address, lat/lng, or DMS like 34°12'02"N 80°41'26"W.`
          )
        );
      });
    });
  }
}
