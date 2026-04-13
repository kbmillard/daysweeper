# Daysweeper pin status — LastLeg ↔ API handoff

This document is the **Daysweeper** source of truth for how **container / route pins** sync with **LastLeg iOS**: what we store, what we return on **GET**, and what **PATCH** accepts. **rb-lastleg-ios** can mirror a short summary; if the two diverge, treat **this file** as canonical unless both teams agree.

---

## Daysweeper context (why this is not “already done”)

- **Map dots:** `MapPin` (static/KML sync) plus **route `Target`s** merged in `src/app/map/empty-map-client.tsx`. Colors there today are driven largely by **corridor / route order**, not the full LastLeg lifecycle.
- **`Target.accountState`** in Prisma is a **small** enum (`NEW_UNCONTACTED`, `NEW_CONTACTED_NO_ANSWER`, `ACCOUNT`) — not the full pin story by itself.
- **Canonical stop outcome** for “what happened on the route” lives on **`RouteStop.outcome`** (`StopOutcome` enum). **`targetToLead`** exposes this to the app as **`route_outcome`** on **GET** (`/api/targets`, `/api/targets/:id`, `/api/targets/dots`).
- **Dashboard “Container pins”** (and similar) bucket by **`accountState`** today; rebucket by **`route_outcome`** later if you want analytics to match LastLeg colors 1:1.

---

## LastLeg visual states (product table)

| Product state | Client behavior (LastLeg) | Canonical `route_outcome` (Daysweeper) |
|---------------|----------------------------|----------------------------------------|
| Default | Blue | `null` / cleared stop outcome (reactivate) |
| Visited — not interested | Black, faded until **Reactivate** | `NOT_INTERESTED` |
| Revisiting — interested | Yellow | `REVISITING_INTERESTED` |
| Visited — deal made | Green | `DEAL_MADE` |
| Containers cleared | White, faded until **Reactivate** | `CONTAINERS_CLEARED` |

**Fade / inactive** is **client-side only**. The API does **not** store a “faded” flag — only **`route_outcome`** + **`visitedAt`** on **`RouteStop`**.

---

## Canonical fields

| Field | Where stored | GET JSON key | PATCH body key |
|-------|----------------|--------------|----------------|
| Route stop outcome | `RouteStop.outcome` | `route_outcome` | `route_outcome` or `routeOutcome` |
| Account / CRM-ish state | `Target.accountState` | `account_state` | `account_state` |
| Legacy visit flags | `RouteStop.visitedAt` + `outcome` | derived from `route_outcome` | `visited`, `status` (legacy; see below) |

**Reactivate (back to blue):** send **`route_outcome: null`** (JSON null). Server sets **`RouteStop.outcome = null`** and **`visitedAt = null`**. Optionally set **`account_state`** to **`NEW_UNCONTACTED`** with the same PATCH.

---

## `StopOutcome` enum (DB + API)

Persisted values on **`RouteStop.outcome`**:

- `VISITED`, `NO_ANSWER`, `WRONG_ADDRESS`, `FOLLOW_UP` (original)
- `NOT_INTERESTED`, `REVISITING_INTERESTED`, `DEAL_MADE`, `CONTAINERS_CLEARED` (LastLeg lifecycle)

Invalid strings → **400** with a list of allowed values.

**LastLeg iOS (shipped):** `API.forPinStatus` should **PATCH** the **canonical** enum strings above (e.g. **`NOT_INTERESTED`**, **`DEAL_MADE`** — not legacy names like `VISITED_NOT_INTERESTED`). The server only persists **`StopOutcome`**. The app may still **accept** legacy strings when **reading** older data or merging local state; that mapping is **client-side**.

---

## Troubleshooting (pin state “drifts” after refresh)

If the app shows the wrong color or resets after **GET** / cold start:

1. **Deploy / URL** — Confirm the app calls your **current production** Daysweeper origin (same host as the web app you trust).
2. **Auth** — **PATCH** and **GET** need the same **Clerk** session or **Bearer** token LastLeg already uses for `/api/targets`.
3. **Route stop exists** — **`RouteStop`** is updated only when this **target** is on a **route** assigned to **`assignedToUserId`** matching the authenticated user. If the stop was never created or the user’s route changed, **`route_outcome`** won’t persist for that lead until the target is on their route again.
4. **Response** — After **PATCH**, use **`target.route_outcome`** from **`{ ok: true, target }`** (or **GET** `/api/targets/:id`) as source of truth — not only optimistic UI.

---

## PATCH `/api/targets/:id`

- **Auth:** same as today — Clerk session or Bearer (see route handler).
- **Merge:** idempotent partial update; only sent fields are applied.
- **`route_outcome`:** JSON **`null`** is supported and **clears** the stop outcome (reactivate).
- **Precedence:** if **`route_outcome` / `routeOutcome`** is present in the JSON body (including explicit **`null`**), it **wins** over legacy **`status`** for **`RouteStop`** updates.
- **Legacy `status`:** still supported when **`route_outcome`** is **omitted** (`visited`, `no_answer`, `trashed`, `active`, or any valid **`StopOutcome`** string).
- **Response:** `{ ok: true, target?: … }` where **`target`** is the same shape as **GET** (`targetToLead`), so iOS can reconcile **`Lead.serverStatus` / `route_outcome`** without an extra round-trip.

### `visitedAt` rules (server)

When applying **`route_outcome`**:

- **`null`** → `outcome` and `visitedAt` cleared.
- **`NO_ANSWER`, `WRONG_ADDRESS`, `FOLLOW_UP`, `REVISITING_INTERESTED`** → `visitedAt` set to **`null`**.
- **`VISITED`, `NOT_INTERESTED`, `DEAL_MADE`, `CONTAINERS_CLEARED`** → `visitedAt` set to **now**.

(Tweak if product wants different timestamps; document changes here.)

---

## GET `/api/targets` and `/api/targets/:id`

- **`route_outcome`** must reflect **`RouteStop.outcome`** for the lead’s stop (already mapped in **`targetToLead`**).
- **`/api/targets/dots`** includes **`routeOutcome`** on each pin for the map overlay — keep in sync with the same DB field.

---

## Web map (optional / phased)

- **`empty-map-client.tsx`** can later call **`deriveLastLegVisualStatus`** (or equivalent) using **`route_outcome` + `account_state`** so web colors match iOS — **only after GET** reliably exposes the new outcomes (which this contract does).

---

## Alignment checklist

- [x] **Canonical fields:** `route_outcome` + `account_state`; `visited` / legacy `status` documented.
- [x] **PATCH:** `PATCH /api/targets/:id`, merge semantics, **`route_outcome: null`** supported.
- [x] **Inactive / reactivate:** no extra “faded” column; reactivate = **`null`** outcome + optional **`account_state`** reset.
- [x] **Persistence:** Prisma **`StopOutcome`** + migration for new enum values.
- [x] **GET:** `targetToLead` includes **`route_outcome`**; PATCH returns refreshed **`target`**.
- [ ] **Web map paint** — optional follow-up.
- [ ] **Dashboard rebucket** — optional follow-up.

---

## § Handoff blurb (paste to iOS / Slack)

> Daysweeper persists LastLeg pin lifecycle on **`RouteStop.outcome`** as **`StopOutcome`**: `NOT_INTERESTED`, `REVISITING_INTERESTED`, `DEAL_MADE`, `CONTAINERS_CLEARED`, plus the original four. **GET** leads include **`route_outcome`** from **`targetToLead`**. **PATCH `/api/targets/:id`** accepts **`route_outcome`** (or **`routeOutcome`**); JSON **`null`** clears outcome + **`visitedAt`** for reactivate. Response includes **`{ ok: true, target }`**. Fade is client-only. See **`docs/DAYSWEEPER_PIN_STATUS_HANDOFF.md`** in daysweeper-main.
