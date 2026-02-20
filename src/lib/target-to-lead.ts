/**
 * Map daysweeper Target to LastLeg Lead JSON format.
 */

function buildMapLinks(address: string): { appleMaps: string; googleMaps: string; googleEarth: string } {
  const q = encodeURIComponent(address);
  return {
    appleMaps: `https://maps.apple.com/?q=${q}`,
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${q}`,
    googleEarth: `https://earth.google.com/web/search/${q}`
  };
}

export function targetToLead(target: {
  id: string;
  company: string;
  parentCompany?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  category?: string | null;
  segment?: string | null;
  addressRaw?: string | null;
  addressNormalized?: string | null;
  latitude?: unknown;
  longitude?: unknown;
  RouteStop?: Array<{ seq: number }>;
}) {
  const addr = target.addressRaw ?? target.addressNormalized ?? '';
  const lat = target.latitude != null ? Number(target.latitude) : null;
  const lng = target.longitude != null ? Number(target.longitude) : null;
  const seq = target.RouteStop?.[0]?.seq;

  return {
    id: target.id,
    company: target.company,
    parent_company: target.parentCompany ?? null,
    website: target.website ?? null,
    category: target.category ?? '',
    segment: target.segment ?? '',
    address: addr || null,
    address_raw: addr || null,
    address_normalized: target.addressNormalized ?? null,
    phone: target.phone ?? null,
    latitude: lat,
    longitude: lng,
    links: buildMapLinks(addr || target.company),
    s: seq ?? null
  };
}
