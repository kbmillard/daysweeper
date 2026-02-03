#!/usr/bin/env swift
/**
 * Geocode locations through Apple (CLGeocoder).
 * Fetches locations from daysweeper, geocodes each, PATCHes lat/lng back.
 *
 * Usage (macOS only):
 *   DAYSWEEPER_URL=https://your-app.vercel.app swift scripts/geocode-apple.swift
 *   DAYSWEEPER_URL=http://localhost:3000 swift scripts/geocode-apple.swift
 *
 * Or compile and run:
 *   swiftc -O -sdk $(xcrun --show-sdk-path) -import-objc-header /dev/null scripts/geocode-apple.swift -o scripts/geocode-apple 2>/dev/null || swiftc -O -sdk $(xcrun --show-sdk-path) scripts/geocode-apple.swift -o scripts/geocode-apple
 *   DAYSWEEPER_URL=http://localhost:3000 ./scripts/geocode-apple
 */

import Foundation
import CoreLocation

let baseURL = ProcessInfo.processInfo.environment["DAYSWEEPER_URL"] ?? "http://localhost:3000"
let missingOnly = ProcessInfo.processInfo.environment["MISSING_ONLY"] ?? "true"

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

func fetchLocations() -> [LocationItem] {
    let urlStr = "\(baseURL)/api/locations/for-geocode?missingOnly=\(missingOnly)"
    guard let url = URL(string: urlStr) else { return [] }
    let sem = DispatchSemaphore(value: 0)
    var result: Result<[LocationItem], Error>?
    URLSession.shared.dataTask(with: url) { data, _, err in
        defer { sem.signal() }
        if let err = err { result = .failure(err); return }
        guard let data = data else { result = .success([]); return }
        do {
            let res = try JSONDecoder().decode(ForGeocodeResponse.self, from: data)
            result = .success(res.locations)
        } catch {
            result = .failure(error)
        }
    }.resume()
    sem.wait()
    if case .success(let locs)? = result { return locs }
    if case .failure(let e)? = result { fputs("Fetch error: \(e)\n", stderr) }
    return []
}

func geocodeAddress(_ address: String) -> (lat: Double, lon: Double)? {
    let geocoder = CLGeocoder()
    var result: (Double, Double)?
    let sem = DispatchSemaphore(value: 0)
    geocoder.geocodeAddressString(address) { placemarks, _ in
        defer { sem.signal() }
        if let loc = placemarks?.first?.location {
            result = (loc.coordinate.latitude, loc.coordinate.longitude)
        }
    }
    sem.wait()
    return result
}

func patchGeocode(locationId: String, lat: Double, lon: Double) -> Bool {
    let urlStr = "\(baseURL)/api/locations/\(locationId)/geocode"
    guard let url = URL(string: urlStr) else { return false }
    var req = URLRequest(url: url)
    req.httpMethod = "PATCH"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try? JSONEncoder().encode(["latitude": lat, "longitude": lon])
    var ok = false
    let sem = DispatchSemaphore(value: 0)
    URLSession.shared.dataTask(with: req) { _, response, _ in
        defer { sem.signal() }
        ok = (response as? HTTPURLResponse)?.statusCode == 200
    }.resume()
    sem.wait()
    return ok
}

func main() {
    fputs("Fetching locations from \(baseURL) (missingOnly=\(missingOnly))...\n", stderr)
    let locations = fetchLocations()
    fputs("Found \(locations.count) locations to geocode.\n", stderr)
    var ok = 0
    var fail = 0
    for (i, loc) in locations.enumerated() {
        let addr = loc.addressRaw.trimmingCharacters(in: .whitespacesAndNewlines)
        if addr.isEmpty { fail += 1; continue }
        if let coords = geocodeAddress(addr) {
            if patchGeocode(locationId: loc.id, lat: coords.lat, lon: coords.lon) {
                ok += 1
                fputs("[\(i + 1)/\(locations.count)] \(loc.id) -> \(coords.lat), \(coords.lon)\n", stderr)
            } else {
                fail += 1
            }
        } else {
            fail += 1
            fputs("[\(i + 1)/\(locations.count)] \(loc.id) -> no result\n", stderr)
        }
        Thread.sleep(forTimeInterval: 0.5)
    }
    fputs("Done. Geocoded: \(ok), failed: \(fail)\n", stderr)
}

main()
