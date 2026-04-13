# AUCTION POLLER FIX REQUIRED

**Problem:** The Auctions page shows 0 lots every time. Toast says "Scraping implementation pending (requires Playwright)."

**Root cause:** The extractor modules (`bidspotter.ts`, `proxibid.ts`) were never implemented. The UI and database are wired up, but the actual HTTP/Playwright code that fetches lots from the auction sites is missing or stubbed.

---

## What needs to be fixed

### 1. Implement the BidSpotter extractor

File: `src/lib/auction-sources/bidspotter.ts` (or wherever the extractors live)

This module must:
- Accept a search term (e.g. "collapsible bulk container")
- Hit BidSpotter's search endpoint or scrape their search results page
- Parse lot data: title, lot URL, auction URL, location, quantity, auctioneer info
- Return an array of normalized lot objects

**BidSpotter search URL pattern:**
```
https://www.bidspotter.com/en-us/search-results?q=collapsible+bulk+container
```

The page is JavaScript-rendered, so you likely need **Playwright** to:
1. Navigate to the search URL
2. Wait for results to load
3. Extract lot cards from the DOM
4. Parse each card for: title, lot URL, location, sale date, current bid

**Example Playwright approach:**
```typescript
import { chromium } from 'playwright';

export async function searchBidSpotter(term: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const url = `https://www.bidspotter.com/en-us/search-results?q=${encodeURIComponent(term)}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  
  // Wait for lot cards to render
  await page.waitForSelector('.lot-card', { timeout: 10000 }).catch(() => null);
  
  const lots = await page.$$eval('.lot-card', (cards) => {
    return cards.map(card => ({
      title: card.querySelector('.lot-title')?.textContent?.trim() || '',
      lotUrl: card.querySelector('a')?.href || '',
      location: card.querySelector('.lot-location')?.textContent?.trim() || '',
      // ... parse other fields
    }));
  });
  
  await browser.close();
  return lots;
}
```

**Note:** The actual CSS selectors depend on BidSpotter's current DOM structure. Inspect the page to get the real selectors.

---

### 2. Implement the Proxibid extractor

File: `src/lib/auction-sources/proxibid.ts`

Same pattern as BidSpotter. Proxibid search URL:
```
https://www.proxibid.com/asp/search.asp?searchstring=collapsible+bulk+container
```

Proxibid is also JS-heavy and will need Playwright.

---

### 3. Wire extractors into the poll runner

File: `src/lib/auction-sources/run-poll.ts` (or wherever the poll orchestration lives)

The poll runner should:
1. Loop through all 36 search terms
2. For each term, call both `searchBidSpotter(term)` and `searchProxibid(term)`
3. Dedupe results by `stableKey` (platform + auctionId + lotId)
4. Upsert into database

**Current state:** It appears the poll runner creates a `PollRun` record immediately but doesn't actually call any extractors — hence 0 lots every time.

---

### 4. Handle Playwright in production

Playwright requires a browser binary. Options:

**A. Local dev only (quick fix)**
- Run poll manually via `tsx scripts/run-auction-poll.ts`
- Playwright works locally, results saved to DB, UI displays them

**B. Vercel deployment (needs workaround)**
- Vercel Functions don't support Playwright natively (binary too large, timeout limits)
- Options:
  - Use a **Browserless.io** or **Bright Data** scraping API instead of local Playwright
  - Run the poll from a **separate worker** (e.g., Railway, Render, or a cron server) that calls a webhook when done
  - Use **Vercel Cron** to trigger a **serverless function** that calls an external scraping service

**Simplest production path:**
1. Sign up for [Browserless](https://www.browserless.io/) (free tier available)
2. Replace `chromium.launch()` with `chromium.connect(wsBrowserlessUrl)`
3. Set `BROWSERLESS_API_KEY` env var in Vercel

---

### 5. Fix the button text

The "Run First Search" button should change label based on state:
- If no polls exist: "Run First Search"
- If polls exist: "Run Search" or "Search Now"

Find the component (likely in `src/app/dashboard/auction-collapsible/page.tsx` or similar) and update:

```tsx
const buttonLabel = pollRuns.length === 0 ? 'Run First Search' : 'Run Search';
```

Also consider:
- Disable button while poll is running
- Show spinner/loading state
- Update "Last Poll" timestamp after completion

---

## Verification checklist

After implementing:

- [ ] Run a poll locally with `npm run dev` and click "Run Search Now"
- [ ] Confirm at least some lots appear (test with "collapsible bulk container" term)
- [ ] Check that lot details are populated: title, URL, location, auctioneer
- [ ] Verify deduplication works (same lot from multiple terms = 1 row)
- [ ] Test "New Only" toggle shows lots from current poll vs previous

---

## Known working lots to test against

These were live as of April 11, 2026:

**BidSpotter:**
- Harry Davis / Irving TX: Uline H-8919 collapsible gaylords in freeze-dried candy liquidation

**Proxibid:**
- Grossman Inc / Cleveland OH: 2 industrial collapsible plastic bulk containers 46×41×40
  - https://www.proxibid.com/Industrial-Machinery-Equipment/MRO-Industrial-Supply/2-INDUSTRIAL-COLLAPSIBLE-PLASTIC-BULK-CONTAINER-46-x-41-x-40-AS-IS/lotInformation/100118958

If these don't appear after a poll, the extractor is not working.

---

## Summary

| Component | Status | Action |
|-----------|--------|--------|
| UI / Page | ✅ Done | — |
| Database models | ✅ Done | — |
| API routes | ✅ Done | — |
| BidSpotter extractor | ❌ Not implemented | Write Playwright scraper |
| Proxibid extractor | ❌ Not implemented | Write Playwright scraper |
| Poll runner | ⚠️ Partial | Wire up extractors |
| Production deployment | ❌ Blocked | Need Browserless or external worker |
| Button text fix | ❌ Minor | Update label logic |

**Priority:** Get the extractors working locally first. Production deployment is a separate concern.
