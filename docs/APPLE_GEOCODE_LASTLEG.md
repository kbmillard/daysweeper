# Run Every Company Address Through Apple Geocoding (LastLeg + daysweeper)

> **Future:** Geocoding should be done on the **backend**, not via macOS script or iOS. See **dev/rb-copilot** (backend) and **rb-copilot-ios** (iOS) for where this logic should live and how to trigger it (e.g. job, cron, or API from copilot).

This doc describes the **current** approach: **daysweeper** (company/location data) is geocoded via a **macOS CLI script** or the **LastLeg** iOS app using Apple’s CLGeocoder, and results are saved back to daysweeper via the APIs below.

## Option A: macOS CLI script (current)

On a Mac, from the repo root:

```bash
# Use your deployed app or local dev server
export DAYSWEEPER_URL=https://your-app.vercel.app   # or http://localhost:3000
./scripts/run-geocode-apple.sh
```

Or compile and run manually:

```bash
xcrun swiftc -O -framework CoreLocation -framework Foundation scripts/geocode-apple.swift -o scripts/geocode-apple
DAYSWEEPER_URL=http://localhost:3000 ./scripts/geocode-apple
```

- Fetches locations with `GET /api/locations/for-geocode?missingOnly=true`
- Geocodes each with **CLGeocoder** (Apple)
- Saves each with `PATCH /api/locations/{locationId}/geocode`
- 0.5s delay between requests to avoid rate limits

## 1. daysweeper APIs (already added)

- **GET** `{DAYSWEEPER_URL}/api/locations/for-geocode`  
  Returns all locations with `addressRaw`.  
  - `?missingOnly=true` → only locations that don’t have latitude/longitude yet.

- **PATCH** `{DAYSWEEPER_URL}/api/locations/{locationId}/geocode`  
  Saves Apple geocode result.  
  - Body: `{ "latitude": 42.123, "longitude": -83.456 }`

Use your deployed daysweeper base URL (e.g. `https://daysweeper.apr.recyclicbravery.com`).

## 2. LastLeg (Xcode): fetch, geocode with Apple, then PATCH back

In **LastLeg** (e.g. a one-off tool target or a “Geocode companies” button):

1. **Fetch locations**  
   `GET {baseURL}/api/locations/for-geocode?missingOnly=true`

2. **Geocode each** with **CLGeocoder** (Apple).

3. **Save each result**  
   `PATCH {baseURL}/api/locations/{locationId}/geocode` with `latitude` and `longitude`.

Example Swift (iOS/macOS with `CoreLocation`):

```swift
import Foundation
import CoreLocation

let baseURL = "https://daysweeper.apr.recyclicbravery.com" // or your daysweeper URL

struct LocationItem: Codable {
    let id: String
    let companyId: String
    let addressRaw: String
    let latitude: Double?
    let longitude: Double?
}

struct ForGeocodeResponse: Codable {
    let locations: [LocationItem]
}

func fetchLocationsToGeocode() async throws -> [LocationItem] {
    let url = URL(string: "\(baseURL)/api/locations/for-geocode?missingOnly=true")!
    let (data, _) = try await URLSession.shared.data(from: url)
    let res = try JSONDecoder().decode(ForGeocodeResponse.self, from: data)
    return res.locations
}

func geocodeAndSave(location: LocationItem) async throws {
    let geocoder = CLGeocoder()
    guard let placemarks = try? await geocoder.geocodeAddressString(location.addressRaw),
          let loc = placemarks.first?.location else { return }
    let lat = loc.coordinate.latitude
    let lon = loc.coordinate.longitude

    var req = URLRequest(url: URL(string: "\(baseURL)/api/locations/\(location.id)/geocode")!)
    req.httpMethod = "PATCH"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try JSONEncoder().encode(["latitude": lat, "longitude": lon])
    let (_, response) = try await URLSession.shared.data(for: req)
    guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw NSError(domain: "Geocode", code: -1, userInfo: nil) }
}

// Run all: fetch → geocode each → PATCH
Task {
    let locations = try await fetchLocationsToGeocode()
    for loc in locations {
        try? await geocodeAndSave(location: loc)
        // optional: small delay to avoid rate limits
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5s
    }
}
```

- Use this in an app target that links **CoreLocation** and has a way to run the `Task` (e.g. button or app launch).
- For **all** addresses (including already geocoded), call the API without `?missingOnly=true` and either skip items that already have lat/lon or overwrite them.

## 3. Where to put this in LastLeg.xcodeproj

- Add a new **Swift file** (e.g. `DaysweeperGeocode.swift`) and paste the logic above, or call it from an existing screen/button.
- Ensure the target has **CoreLocation** capability / framework.
- Set `baseURL` to your daysweeper URL (e.g. from a config or build setting).

## 4. Optional: auth

If you add auth to these API routes later, send the same token in the `Authorization` header from LastLeg when calling GET and PATCH.
