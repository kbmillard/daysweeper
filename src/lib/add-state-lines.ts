/**
 * Adds US state boundary lines to a Google Maps instance via the Data layer.
 * Works on SATELLITE map type (styles[] does not work on satellite).
 * Fetches GeoJSON once, caches it in memory, re-applies on maptypeid_changed
 * so lines never disappear when switching map types or on re-render.
 */

let cachedGeoJson: object[] | null = null;

async function fetchGeoJson(): Promise<object[]> {
  if (cachedGeoJson) return cachedGeoJson;
  const res = await fetch('/us-states.geojson');
  const json = await res.json();
  cachedGeoJson = json;
  return json;
}

function applyStyle(map: google.maps.Map): void {
  map.data.setStyle({
    strokeColor: '#ffffff',
    strokeWeight: 1.8,
    strokeOpacity: 0.9,
    fillOpacity: 0,
    clickable: false,
  });
}

async function loadIntoMap(map: google.maps.Map): Promise<void> {
  // Clear existing features so we don't double-add on re-apply
  map.data.forEach((f) => map.data.remove(f));
  await map.data.loadGeoJson('/us-states.geojson');
  applyStyle(map);
}

export async function addStateLines(map: google.maps.Map): Promise<void> {
  try {
    await loadIntoMap(map);
    // Re-apply whenever the map type changes (satellite ↔ roadmap etc.)
    map.addListener('maptypeid_changed', () => {
      void loadIntoMap(map).catch(() => {/* non-fatal */});
    });
  } catch {
    // Non-fatal — map still works without state lines
  }
}
