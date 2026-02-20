# LastLeg URL Scheme (daysweeper → LastLeg)

The daysweeper web app opens the LastLeg iOS app via a custom URL scheme. LastLeg must register this scheme and handle the URLs.

## 1. Register URL scheme in LastLeg

Add to `Info.plist` in LastLeg (rb-lastleg-ios):

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.recyclicbravery.lastleg</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>lastleg</string>
    </array>
    <key>CFBundleURLRole</key>
    <string>Editor</string>
  </dict>
</array>
```

Or in Xcode: Target → Info → URL Types → add URL Scheme `lastleg`.

## 2. URLs daysweeper sends

### Open LastLeg (geocoding page)

- `lastleg://`
- Opens the app. LastLeg can fetch `GET {baseUrl}/api/locations/for-geocode?missingOnly=true` and geocode.

### Add to LastLeg (location detail page)

- `lastleg://geocode?locationId=xxx&addressRaw=yyy&companyId=zzz&baseUrl=www`
- Query params:
  - `locationId` – daysweeper location ID
  - `addressRaw` – full address string
  - `companyId` – parent company ID
  - `baseUrl` – daysweeper origin (e.g. `https://daysweeper.apr.recyclicbravery.com`)

## 3. LastLeg handling

When opened with `lastleg://geocode?...`:

1. Parse `locationId`, `addressRaw`, `companyId`, `baseUrl`.
2. Geocode `addressRaw` with CLGeocoder.
3. On success: `PATCH {baseUrl}/api/locations/{locationId}/geocode` with `{ "latitude": ..., "longitude": ... }`.

When opened with `lastleg://` (no params):

1. Use stored or default daysweeper base URL.
2. `GET {baseUrl}/api/locations/for-geocode?missingOnly=true`.
3. Geocode each location and PATCH results.

## 4. Override scheme

Set `NEXT_PUBLIC_LASTLEG_URL_SCHEME` in daysweeper `.env` to use a different scheme (e.g. `rbLastLeg`).
