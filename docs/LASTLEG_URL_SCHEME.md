# LastLeg URL scheme — planned routes (Daysweeper ↔ iOS)

**Daysweeper** owns the canonical contract in **`docs/LASTLEG_URL_SCHEME.md`** in this repository. **rb-lastleg-ios** mirrors this document in its own `docs/LASTLEG_URL_SCHEME.md` as the **iOS-side reference** for deep links and the **`/lastleg` API bundle**. Structure, behavior, and technical wording are kept parallel so the two files are easy to **diff** and keep in sync. If the copies diverge, treat **this** file as **source of truth** unless both teams agree on a change.

This document matches the contract shared with **LastLeg (rb-lastleg-ios)**. Wording may differ slightly in the iOS copy (e.g. “mirror” vs “source of truth”); sections should still line up.

---

## Register URL scheme (iOS)

LastLeg registers the custom URL scheme in **`Info.plist`** under **`CFBundleURLTypes`**:

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

If you override the scheme on web, **`CFBundleURLSchemes` must use the same string** as Daysweeper emits (see **§5 Override scheme**), or deep links will not open the app.

---

## Canonical link (planned routes)

Use **`lastleg://planned-route?…`** for anything new.

Example:

```text
lastleg://planned-route?routeId=<uuid>&baseUrl=https://your-daysweeper-origin
```

Percent-encode `baseUrl` in the query string when needed (e.g. `https%3A%2F%2F…`).

**Deprecated URL hosts** (still accepted by LastLeg iOS for older builds; **do not emit** from new code):

- `lastleg://send-route?…`
- `lastleg://planned?…`

Prefer **`planned-route`** everywhere so behavior stays unambiguous.

**Query parameter aliases** (Daysweeper emits camelCase; iOS accepts both):

| Role              | Primary (Daysweeper web) | Alias (iOS)   |
| ----------------- | ------------------------ | ------------- |
| Route id          | `routeId`                | `route_id`    |
| API origin        | `baseUrl`                | `base_url`    |

Origin only, no trailing slash. If **`baseUrl`** / **`base_url`** is omitted, LastLeg uses **`AppConfig.apiBaseURL`** (configured Daysweeper origin).

**Daysweeper web implementation:** `src/lib/lastleg-url.ts` — **`buildLastLegPlannedRouteUrl`**, **`safeOpenLastLegPlannedRoute`** (mobile open), clipboard on desktop — used from **`src/components/map/route-planner-sheet.tsx`** (**Send route to LastLeg**). Sends **`routeId`** + **`baseUrl`**.

---

## Other LastLeg URLs (Daysweeper → app)

| URL                    | Purpose                                      | Typical server / app flow |
| ---------------------- | -------------------------------------------- | ------------------------- |
| `lastleg://`           | Open app; refresh geocode queue from server  | `GET {baseUrl}/api/locations/for-geocode?missingOnly=true`, then geocode and `PATCH` results |
| `lastleg://geocode?…`  | Hand off one location for Apple geocode      | Parse params → geocode → `PATCH {baseUrl}/api/locations/{locationId}/geocode` |

Daysweeper builds **`lastleg://geocode?…`** via **`buildLastLegGeocodeUrl`** in `src/lib/lastleg-url.ts` (location detail / Add to LastLeg flows).

---

## Server: `GET …/api/routes/{routeId}/lastleg`

After opening **`lastleg://planned-route?…`**, LastLeg normalizes **`baseUrl`**, then:

- **`GET {normalizedBase}/api/routes/{routeId}/lastleg`**

Use the **same Clerk session / Bearer token** path as **`GET /api/targets`**.

**Daysweeper implementation:** `src/app/api/routes/[routeId]/lastleg/route.ts`.

**Response JSON (summary):**

- `route` — `{ id, name, updatedAt }`
- `planner` — same shape as **`GET /api/route-planner`** (corridor, radius, ranked ids; may be inactive if web never **Apply**’d for this route).
- `targets` — leads for that route’s stops, in order.
- `hasStoredCorridorJson` — whether a `corridorPlanner` blob exists on the row.

---

## LastLeg iOS behavior (implemented)

1. On **`lastleg://planned-route?…`**, normalize **`baseUrl`**, then **`GET …/lastleg`** as above.
2. **Enqueue only** — append to **planned-routes**; do **not** replace the live route or corridor until the user taps **Use route** (Route tab).
3. After a successful import, **`leadsManager.refresh()`** so returned targets show up.
4. **Use route** applies bundled stop order; if **`planner.active` is `true`**, apply corridor like synced route-planner state. **Inactive** planner does **not** clear the current corridor.

**Web entry point:** map **Route** sheet → **Send route to LastLeg** (`route-planner-sheet.tsx`).

On iOS, parsing/handlers live alongside **`DaysweeperGeocodeService`** (geocode URL) and **`LastLegApp`** (bare open / refresh); align those files when changing URL behavior.

---

## Legacy dev-only (no server round-trip)

**`ids=`** / repeated **`id=`** (optional **`title`** / **`name`**) — quick inline tests without **`GET …/lastleg`**. **Not** a production path from Daysweeper; use **`planned-route`** + API for real routes.

---

## Geocode URL handling (`lastleg://geocode?…` and bare `lastleg://`)

**`lastleg://geocode?…`** — Daysweeper sends **`locationId`** and **`addressRaw`** (both required for the web-built URL), plus optional **`companyId`**, **`baseUrl`**, **`latitude`**, **`longitude`** via **`buildLastLegGeocodeUrl`** in `lastleg-url.ts`. iOS may also accept **`lat`** / **`lng`** as aliases for **`latitude`** / **`longitude`**.

Flow:

1. Parse query (**`locationId`** required for **`PATCH …/locations/{locationId}/geocode`**).
2. If **both** coordinates are present (**`latitude`**/**`longitude`** or **`lat`**/**`lng`**), LastLeg may use them directly (e.g. create target / PATCH) and **skip** CLGeocoder; otherwise geocode **`addressRaw`**.
3. On success: **`PATCH {baseUrl}/api/locations/{locationId}/geocode`** with `{ "latitude": …, "longitude": … }` when updating Daysweeper.

**Bare `lastleg://`** (no query):

1. Resolve **`baseUrl`** (stored default / **`AppConfig`**).
2. **`GET {baseUrl}/api/locations/for-geocode?missingOnly=true`**.
3. Geocode each row; **`PATCH`** results back.

---

## §4 — Handoff blurb (paste to collaborators / other repos)

Copy everything in the block below as a single message when aligning another codebase or team with this contract:

> LastLeg iOS implements the contract in `docs/LASTLEG_URL_SCHEME.md`. On `lastleg://planned-route?routeId=…&baseUrl=…` we normalize `baseUrl`, then `GET {baseUrl}/api/routes/{routeId}/lastleg` with the same Clerk session as `/api/targets`. We only enqueue the plan locally; we do not replace the user’s current run until they tap **Use route** in the Route tab. **Use route** applies your ordered targets to stop order and, when `planner.active` is true, applies the corridor from `planner` (same fields as `/api/route-planner`). If `baseUrl` is omitted we fall back to the app’s configured API origin.
>
> Daysweeper’s `src/lib/lastleg-url.ts` (`buildLastLegPlannedRouteUrl` plus phone vs desktop open/copy) matches that flow; no change needed on the web side unless you want to standardize query names—we accept `routeId` / `route_id` and `baseUrl` / `base_url`.
>
> We still support a legacy `ids=` deep link for dev-only inline plans without a server round-trip.

---

## §5 — Override scheme

**Daysweeper (web):** set **`NEXT_PUBLIC_LASTLEG_URL_SCHEME`** in `.env` (e.g. `rbLastLeg`) so `src/lib/lastleg-url.ts` emits that scheme instead of `lastleg`.

**LastLeg (iOS):** **`CFBundleURLSchemes`** in URL Types must use the **same** scheme string, or deep links from the web will not open the app.
