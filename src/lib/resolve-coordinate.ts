import { geocodeAddress } from '@/lib/geocode-server';

/** Parse `lat, lng` or geocode a single-line address (same rules as LastLeg iOS). */
export async function resolveCoordinate(text: string): Promise<{ lat: number; lng: number } | null> {
  const t = text.trim();
  if (!t) return null;
  const parts = t.split(',').map((s) => s.trim());
  if (parts.length === 2) {
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }
  const r = await geocodeAddress(t);
  return r ? { lat: r.latitude, lng: r.longitude } : null;
}
