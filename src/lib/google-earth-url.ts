/**
 * Google Earth Web URL for a point (opens in browser).
 * Uses altitude (a) and distance (d) – larger d = more zoomed out (regional view).
 * @see https://earth.google.com/web/
 */
export function googleEarthUrl(lat: number, lng: number): string {
  const alt = 0;
  const dist = 25000; // ~25km – zoomed in (neighborhood/city level)
  return `https://earth.google.com/web/@${lat},${lng},${alt}a,${dist}d,1y,0h,0t,0r`;
}
