/**
 * Regrid map URL centered on a coordinate.
 * Opens the nationwide parcel viewer at the given point.
 *
 * Regrid uses /us path with @zoom,lat,lng hash format
 */
export function regridUrl(lat: number, lng: number, zoom = 18): string {
  return `https://app.regrid.com/us#@${zoom},${lat.toFixed(6)},${lng.toFixed(6)}`;
}
