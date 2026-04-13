/**
 * Polyline corridor distance + ordering — matches LastLeg iOS `RouteFilterBar` geometry (CLLocation distances).
 */

export type LatLng = { lat: number; lng: number };

const EARTH_R_M = 6_371_000;

function distanceMeters(a: LatLng, b: LatLng): number {
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return 2 * EARTH_R_M * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function projectAlongRoute(coord: LatLng, start: LatLng, end: LatLng): number {
  const ab = distanceMeters(start, end);
  if (ab <= 0) return 0;
  const ap = distanceMeters(start, coord);
  const bp = distanceMeters(end, coord);
  const denom = 2 * ab * ap;
  if (denom <= 0) return 0;
  const cosA = (ab * ab + ap * ap - bp * bp) / denom;
  return ap * Math.max(-1, Math.min(1, cosA));
}

function segmentClosestDistanceAndArc(
  point: LatLng,
  lineStart: LatLng,
  lineEnd: LatLng
): { perp: number; arcFromStart: number } {
  const ab = distanceMeters(lineStart, lineEnd);
  if (ab <= 0) {
    return { perp: distanceMeters(point, lineStart), arcFromStart: 0 };
  }
  const t = Math.max(0, Math.min(1, projectAlongRoute(point, lineStart, lineEnd) / ab));
  const interpLat = lineStart.lat + t * (lineEnd.lat - lineStart.lat);
  const interpLng = lineStart.lng + t * (lineEnd.lng - lineStart.lng);
  return {
    perp: distanceMeters(point, { lat: interpLat, lng: interpLng }),
    arcFromStart: t * ab
  };
}

export function minDistanceToPolyline(point: LatLng, vertices: LatLng[]): number {
  if (vertices.length < 2) return Number.POSITIVE_INFINITY;
  let minD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < vertices.length - 1; i++) {
    const { perp } = segmentClosestDistanceAndArc(point, vertices[i], vertices[i + 1]);
    minD = Math.min(minD, perp);
  }
  return minD;
}

export function arcPositionAlongPolyline(coord: LatLng, vertices: LatLng[]): number {
  if (vertices.length < 2) return 0;
  let bestDist = Number.POSITIVE_INFINITY;
  let bestArc = 0;
  let cumulative = 0;
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i];
    const b = vertices[i + 1];
    const { perp, arcFromStart } = segmentClosestDistanceAndArc(coord, a, b);
    const arcTotal = cumulative + arcFromStart;
    if (perp < bestDist - 0.25 || (Math.abs(perp - bestDist) <= 0.25 && arcTotal < bestArc)) {
      bestDist = perp;
      bestArc = arcTotal;
    }
    cumulative += distanceMeters(a, b);
  }
  return bestArc;
}

export type GeocodedTarget = { id: string; lat: number; lng: number };

export function filterAndRankTargetsAlongCorridor(
  targets: GeocodedTarget[],
  vertices: LatLng[],
  radiusMeters: number
): { filteredIds: Set<string>; rankedIds: string[] } {
  const inCorridor = targets.filter((t) => {
    const coord = { lat: t.lat, lng: t.lng };
    return minDistanceToPolyline(coord, vertices) <= radiusMeters;
  });
  const ranked = [...inCorridor].sort((a, b) => {
    const posA = arcPositionAlongPolyline({ lat: a.lat, lng: a.lng }, vertices);
    const posB = arcPositionAlongPolyline({ lat: b.lat, lng: b.lng }, vertices);
    return posA - posB;
  });
  return {
    filteredIds: new Set(ranked.map((t) => t.id)),
    rankedIds: ranked.map((t) => t.id)
  };
}
