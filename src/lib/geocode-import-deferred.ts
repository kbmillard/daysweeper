/**
 * CRM / seller JSON import does not run server bulk geocode (Nominatim / Mapbox).
 * Coordinates align with the Apple pipeline: LastLeg iOS (CLGeocoder), scripts/geocode-apple.swift,
 * PATCH /api/locations/{id}/geocode, or web map MapKit search when users add pins.
 *
 * Optional server batch geocoding remains available at POST /api/geocode/bulk.
 */
export const IMPORT_GEOCODE_DEFERRED = {
  deferred: true as const,
  hint:
    'Missing coordinates: GET /api/locations/for-geocode?missingOnly=true — then LastLeg, geocode-apple.swift, or POST /api/geocode/bulk for explicit OSM/Mapbox batch.',
} as const;
