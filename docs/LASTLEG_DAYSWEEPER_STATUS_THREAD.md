# LastLeg ↔ Daysweeper — status thread (closeout notes)

Cross-team snapshot: what to tell LastLeg, what Daysweeper shipped, and how to debug drift.

---

## Tell the LastLeg person

- **Daysweeper has shipped** **`route_outcome`** persistence on **`RouteStop.outcome`** (**`StopOutcome`** enum), **PATCH** + **GET** contract, and **`{ ok: true, target }`** on PATCH. See **`docs/DAYSWEEPER_PIN_STATUS_HANDOFF.md`**.
- **LastLeg iOS** should **PATCH** canonical values (**`NOT_INTERESTED`**, **`DEAL_MADE`**, **`REVISITING_INTERESTED`**, **`CONTAINERS_CLEARED`** (UI: **Material Cleared**), plus originals) — aligned with shipped **`API.forPinStatus`**.
- If anything still looks wrong after that, it’s usually **deploy / base URL**, **Clerk auth**, or **no `RouteStop` for that user’s route** — not “API missing fields” on current main.

---

## Daysweeper (this repo) — shipped

| Item | Doc / code |
|------|------------|
| Planned route deep link + **`GET /api/routes/[routeId]/lastleg`** | **`docs/LASTLEG_URL_SCHEME.md`** |
| Pin status **`route_outcome`** + **`StopOutcome`** migration | **`docs/DAYSWEEPER_PIN_STATUS_HANDOFF.md`**, **`src/app/api/targets/[id]/route.ts`** |
| Sentry (web) vs iOS DSN | **`docs/SENTRY_LASTLEG_HANDOFF.md`** |
| Local iOS build (Mac / Xcode) | **`docs/BUILD_LASTLEG_IOS_LOCAL.md`** |

---

## Optional (not blocking)

- **Sentry in LastLeg** — follow **`docs/SENTRY_LASTLEG_HANDOFF.md`** in this repo; iOS adds SDK + **iOS project DSN** (not Vercel vars).
- **Web map / dashboard** — optional parity with pin colors / rebucketing by **`route_outcome`** (`empty-map-client`, overview KPIs).

---

## iOS repo docs (rb-lastleg-ios)

LastLeg may maintain parallel docs (e.g. rewritten **`DAYSWEEPER_PIN_STATUS_HANDOFF`**, **`LASTLEG_SCOPE_DAYSWEEPER_VS_IOS`**, **`IOS_BUILDER_HANDOFF`**). **Canonical API + DB contract** for the backend stays **`docs/DAYSWEEPER_PIN_STATUS_HANDOFF.md`** in **daysweeper-main** unless both teams agree to change it.
