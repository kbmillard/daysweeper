/**
 * Adds US state boundary lines to a Google Maps instance via the Data layer.
 * Works on SATELLITE map type (styles[] does not work on satellite).
 * Fetches a lightweight GeoJSON from the public folder (bundled at build time).
 */
export async function addStateLines(map: google.maps.Map): Promise<void> {
  try {
    // Use the US Census low-res states GeoJSON (served from /public)
    await map.data.loadGeoJson('/us-states.geojson');
    map.data.setStyle({
      strokeColor: '#ffffff',
      strokeWeight: 1.5,
      strokeOpacity: 0.85,
      fillOpacity: 0,       // transparent fill — lines only
      clickable: false,
    });
  } catch {
    // Non-fatal — map still works without state lines
  }
}
