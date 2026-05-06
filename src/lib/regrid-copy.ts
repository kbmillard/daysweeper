/**
 * Clipboard string for Regrid / parcel lookup — decimal degrees, same density as pin “Copy lat,lng”.
 */
export function pinLatLngClipboardText(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
