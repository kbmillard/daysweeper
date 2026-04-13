# Cursor agent spec: Collapsible container auction poller (BidSpotter + Proxibid)

**Repo:** `daysweeper-main` (Next.js App Router, Prisma/PostgreSQL, Clerk)  
**Audience:** Cursor agent implementing this feature in *this* codebase.  
**Owner intent:** Poll two auction platforms for industrial **collapsible bulk containers** (and close synonyms), store structured results, show them on a **new dashboard page**, and support **re-runs** with a **“new since last run”** view.

---

## 1. Product requirements

### 1.1 What to find

Treat a result as **in-scope** when lot title and/or description strongly suggests **reusable industrial bulk packaging**, especially:

- Collapsible / fold-down / knock-down **pallet containers**, **bulk bins**, **gaylords** (plastic), **bulk totes**
- Brands/patterns often listed: **Orbis**, **Buckhorn**, **Monoflo**, **Schoeller Allibert**, **ULINE** (e.g. H-8919, H-1736-style), **returnable container**, **RPC**, **FLC** (foldable large container)

**Out of scope** (exclude or tag as “not target” in UI):

- Intermodal **shipping containers** (20′/40′ sea cans) unless the copy clearly also includes collapsible *bulk* totes in the same lot
- Household “collapsible storage bins,” closet cubes, small totes (use heuristics: dimensions & “pallet,” “forklift,” “gaylord,” “bulk,” “warehouse,” “distribution”)

### 1.2 Search query set (run all; dedupe by stable lot key)

Implement a **configurable list** (e.g. `src/config/auction-collapsible-search-terms.ts`) of strings. Minimum set — include **singular and plural** variants where grammar differs:

```text
collapsible bulk container, collapsible bulk containers
collapsible pallet container, collapsible pallet containers
collapsible gaylord, collapsible gaylords
collapsible plastic gaylord, collapsible plastic gaylords
plastic bulk container, plastic bulk containers
foldable bulk container, foldable bulk containers
folding bulk container, folding bulk containers
knockdown bulk container, knock down bulk container
returnable bulk bin, returnable bulk bins
pallet box collapsible, collapsible pallet box
Orbis collapsible, Buckhorn collapsible, Monoflo gaylord
Uline collapsible gaylord, ULINE collapsible
FLC container, foldable large container
bulk tote collapsible, collapsible bulk tote
poly gaylord, reusable gaylord
```

The agent may **expand** this list from user feedback; keep everything in one exported array for easy diffing in PRs.

### 1.3 Platforms

1. **BidSpotter** (`bidspotter.com`) — US catalog/search flows  
2. **Proxibid** (`proxibid.com`) — search / lot discovery

**Important:** Both sites are JS-heavy and may use anti-bot measures. Prefer **Playwright** (or the project’s chosen browser automation) for reliable extraction, with **polite rate limits**, retries, and structured logging. Plain `fetch` is acceptable only if proven stable for the exact URLs used; document failure modes.

### 1.4 New UI page (Daysweeper)

Add a **new route** under the existing dashboard pattern, e.g.:

- `src/app/dashboard/auction-collapsible/page.tsx` (or `/dashboard/sourcing/collapsible-auctions` — match existing URL conventions)

**Sidebar:** Register the page in [`src/config/nav-config.ts`](src/config/nav-config.ts) so it appears in the app sidebar (same pattern as other dashboard entries).

**Page contents:**

| Section | Behavior |
|--------|----------|
| **Run poll** | Button: “Run search now” → triggers server job or API route that executes searches for all terms on both platforms |
| **Last run** | Timestamp, duration, error summary if partial failure |
| **Filters** | Platform, state/region (if parsed), date range, “in-scope only,” text search on title |
| **View mode** | Toggle: **All results** / **New since last successful run** |
| **Results table** | One row per **lot** (not per search term); columns below |

**Row / detail fields (minimum):**

- **Platform** (`bidspotter` \| `proxibid`)
- **Link** — canonical lot URL (and optional auction/catalog URL)
- **Lot number** and **lot title**
- **Quantity** — integer parsed from title/description when possible; if unknown, show `null` and “verify” badge
- **Auction / event name**
- **Location** — city, state, full address if available
- **Sale dates** — start/end or “closes at” if present
- **Auctioneer** — company name, phone, email, website if present
- **Contact person** — *only if explicitly listed* (e.g. “contact Mo Bovenzi,” named removal coordinator); do not invent
- **Matched search term(s)** — which queries hit this lot (for debugging)
- **Raw snippet** — short excerpt of description for human verification

**Aggregates:**

- Per **auction/catalog**: **sum of parsed quantities** (ignore nulls in sum; show “N lots, M qty known, unknown: K lots”)

### 1.5 “New only” on re-run

- Persist each poll as a **`PollRun`** record with `id`, `startedAt`, `finishedAt`, `status`, `errorLog` (json/text).
- Persist each lot as a **`AuctionLotSnapshot`** (or normalize into `AuctionLot` + `AuctionLotSeenRun` — agent’s choice) with a **stable unique key**:

  **Suggested stable ID:**  
  `platform:auctionSlugOrId:lotIdOrLotNumber`  
  (Normalize casing; strip tracking query params from URLs before hashing if using URL-based ids.)

- On each successful run:
  - Upsert lots by stable ID.
  - Mark which run first saw each lot (`firstSeenRunId`).
- **“New since last run”** = lots whose `firstSeenRunId === currentRun.id` **OR** lots not present in the previous successful run’s snapshot set (agent: pick one consistent definition and document it in code comments — recommend **firstSeenRunId** for clarity).

**Edge cases:**

- If a lot **disappears** then reappears later, treat as **new** if not in DB, or **updated** if same stable ID — show “updated title/qty” optionally in v2.
- Deduplicate: same lot may match multiple search terms → **one row**, `matchedTerms: string[]`.

---

## 2. Technical implementation guidance (this repo)

### 2.1 Stack alignment

- **Next.js App Router** — use **Route Handlers** (`src/app/api/.../route.ts`) for “run poll” and “list results.”
- **Prisma + PostgreSQL** — add models for runs and lots; migrate with `prisma migrate`.
- **Auth** — protect API routes and the dashboard page with the same Clerk middleware / patterns used elsewhere (mirror an existing dashboard API).
- **Background execution:** If poll duration is long, use one of:
  - **Vercel:** limitations on serverless duration — prefer splitting work per platform or per term, or run poll via **`waitUntil`** / queue (if already in project) / external worker.
  - **Local/dev:** long-running `tsx` script OK; for production, document that user may need **cron** + internal secret or **manual button** with chunked requests.

The agent should **inspect** existing patterns: other `scripts/*.ts`, `src/app/api/**`, and Prisma models before choosing job style.

### 2.2 Suggested Prisma models (sketch)

```prisma
model AuctionPollRun {
  id          String   @id @default(cuid())
  startedAt   DateTime @default(now())
  finishedAt  DateTime?
  status      String   // pending | running | success | partial | failed
  errorLog    Json?
  createdBy   String?  // clerk user id if available
  lots        AuctionLotSnapshot[]
}

model AuctionLotSnapshot {
  id              String   @id @default(cuid())
  stableKey       String   @unique
  platform        String
  auctionUrl      String?
  lotUrl          String
  lotNumber       String?
  title           String
  quantity        Int?
  quantityRaw     String?
  auctionTitle    String?
  locationLine    String?
  city            String?
  state           String?
  saleStart       DateTime?
  saleEnd         DateTime?
  auctioneerName  String?
  auctioneerPhone String?
  auctioneerEmail String?
  contactName     String?
  contactDetail   String?
  matchedTerms    String[]
  descriptionExcerpt String?
  firstSeenRunId  String
  lastSeenRunId   String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  firstSeenRun    AuctionPollRun @relation(fields: [firstSeenRunId], references: [id])
}
```

Adjust names to fit existing naming conventions; add indexes on `platform`, `state`, `lastSeenRunId`, `firstSeenRunId`.

### 2.3 Extractors

- **BidSpotter:** Implement a module `src/lib/auction-sources/bidspotter.ts` that:
  - Accepts a search term
  - Returns normalized `RawLot[]`  
  Document the **exact entry URL** pattern used (search page + query string) and keep selectors in **one place** so DOM changes are a single-file fix.

- **Proxibid:** Same in `src/lib/auction-sources/proxibid.ts`.

- **Shared normalizer:** `src/lib/auction-sources/normalize.ts` — map each platform’s JSON/HTML into the same shape; parse quantity via regex helpers, e.g. `(\\d+)\\s*(x|qty|units)?` near keywords, leading count in title like `(10)` or `Lot of 10`.

### 2.4 Quantity parsing (heuristic)

- Prefer explicit phrases: `lot of 12`, `qty: 40`, `(25)`, `25 each`, `approx 100`
- If multiple numbers, prefer the one adjacent to **container/bin/gaylord/tote**
- Never fabricate — `null` is OK

### 2.5 Compliance & robustness

- Respect **robots.txt** and site **Terms of Use**; implement **low concurrency** (e.g. 1–2 concurrent pages), **jitter**, and **backoff**.
- Do not bypass CAPTCHA; if blocked, surface a clear UI error: “Proxibid blocked automated access; run locally logged in” (optional v2: “upload HTML export”).
- Log HTTP status and screenshot path on failure for debugging (dev only).

### 2.6 Testing

- **Unit tests** for: `stableKey` builder, quantity parser, dedupe merge, “new since last run” diff.
- **Optional:** recorded Playwright fixtures (small HTML snapshots) to avoid live network in CI.

### 2.7 Env configuration

- `AUCTION_POLL_SECRET` — optional header secret for cron-triggered runs  
- Feature flag: `ENABLE_AUCTION_POLLER=true` to hide route in prod until ready

---

## 3. Acceptance criteria (checklist for the agent)

- [ ] New dashboard page live in sidebar with table + detail expansion (or drawer) for full fields  
- [ ] “Run search now” triggers poll and persists **PollRun** + lot rows  
- [ ] All configured search terms executed on **both** platforms; results **deduped** by stable key  
- [ ] Each row shows **link**, **location**, **auctioneer contact** fields when available; **contact person** only when explicitly present  
- [ ] Per-lot **quantity** when parseable; per-auction **total known quantity** summary  
- [ ] Toggle **“New since last run”** compares to previous successful run and filters correctly  
- [ ] Errors on one platform do not silently drop the other (status `partial` + error log)  
- [ ] README or short `docs/AUCTION_POLLER.md` explains how to run locally and deploy constraints

---

## 4. Non-goals (v1)

- eBay, GovDeals, HiBid (unless user later extends `auction-sources/`)
- Guaranteed 100% accurate quantities without human verification
- Shipping cost estimates or map routing

---

## 5. File placement summary (suggested)

| Area | Path |
|------|------|
| Search terms | `src/config/auction-collapsible-search-terms.ts` |
| Extractors | `src/lib/auction-sources/{bidspotter,proxibid,normalize}.ts` |
| Poll orchestration | `src/lib/auction-sources/run-poll.ts` |
| API | `src/app/api/auction-collapsible-poll/route.ts` (POST run, GET status) |
| API list | `src/app/api/auction-collapsible-lots/route.ts` (GET with `?newSince=last`) |
| UI | `src/app/dashboard/auction-collapsible/page.tsx` |
| Prisma | `prisma/schema.prisma` + migration |
| Nav | `src/config/nav-config.ts` |

---

*End of spec. Implement in small PRs: schema + API + single-platform proof + second platform + UI + diff view.*
