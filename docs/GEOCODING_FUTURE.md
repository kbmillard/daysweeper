# Geocoding: future backend implementation

**Geocoding should be done on the backend**, not via the macOS CLI script or the iOS app.

- **Backend (where to implement):** `dev/rb-copilot` (rb-copilot)
- **iOS (reference / trigger):** `rb-copilot-ios`

The backend should own:

1. Fetching locations that need geocoding (same contract as daysweeper’s `GET /api/locations/for-geocode?missingOnly=true`, or shared DB).
2. Geocoding (e.g. Apple Maps API, Google, or another server-side provider).
3. Writing results back (e.g. daysweeper’s `PATCH /api/locations/{locationId}/geocode`, or shared DB).

Triggering can be a scheduled job, cron, or an API/copilot action. The macOS script and iOS CLGeocoder flow in this repo are temporary until rb-copilot implements this.
