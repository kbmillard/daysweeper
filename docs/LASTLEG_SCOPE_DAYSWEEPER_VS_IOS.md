# Scope: Daysweeper (web/API) vs LastLeg (iOS)

## Backend — aligned

Daysweeper **owns** persistence and the HTTP contract for:

- **Planned routes:** `lastleg://planned-route` → **`GET /api/routes/[routeId]/lastleg`** (see **`docs/LASTLEG_URL_SCHEME.md`**).
- **Pin / stop outcomes:** **`RouteStop.outcome`** (`StopOutcome`), **PATCH/GET** **`route_outcome`** on leads (see **`docs/DAYSWEEPER_PIN_STATUS_HANDOFF.md`**).

LastLeg **PATCHes** the same **canonical enum strings** the API accepts (e.g. **`NOT_INTERESTED`**, **`DEAL_MADE`**).

## iOS-only

- URL handling, UI, colors, fade, **Reactivate**, TestFlight, Fastlane, on-device QA.
- Optional **Sentry** (iOS DSN) per **`docs/SENTRY_LASTLEG_HANDOFF.md`**.

## Daysweeper-only (optional polish)

- Web map pin colors from **`route_outcome`** (`empty-map-client.tsx`).
- Dashboard analytics rebucketed by **`route_outcome`** instead of only **`accountState`**.

## If something breaks

See **Troubleshooting** in **`docs/DAYSWEEPER_PIN_STATUS_HANDOFF.md`** (URL, Clerk, route assignment).  
Thread-level notes: **`docs/LASTLEG_DAYSWEEPER_STATUS_THREAD.md`**.
