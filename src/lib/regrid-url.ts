/**
 * Regrid map URL centered on a coordinate.
 * Opens the nationwide parcel viewer at the given point.
 *
 * Hash format: #zoom/lat/lng (standard slippy map convention)
 */
export function regridUrl(lat: number, lng: number, zoom = 18): string {
  return `https://app.regrid.com/#${zoom}/${lat}/${lng}`;
}
