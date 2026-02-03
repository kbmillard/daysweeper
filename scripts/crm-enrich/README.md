# CRM Parent/Subsidiary Enrichment (v4 → v5)

Fills **missing parent/subsidiary websites** and **street-level addresses** using **only official company websites**.

## Inputs

- **`crm_parent_subsidiary_hierarchy_v4.json`** (required) – Master hierarchy (same structure as v4).
- **`crm_parent_subsidiary_work_queue_v4.json`** (optional) – Work queue. If absent, the script derives it from the hierarchy:
  - Companies with `website == null`
  - Locations that lack a street number in `addressRaw`

Work queue format (optional):

```json
{
  "companyExternalIds": ["cmp_xxx", "cmp_yyy"],
  "locationExternalIds": ["loc_aaa", "loc_bbb"]
}
```

Omit the file to process all companies missing website and all locations missing street-level address.

## Outputs

- **`crm_parent_subsidiary_hierarchy_v5.json`** – Same structure as v4, with:
  - `website` set where an official site was found and verified.
  - For locations: **`metadata.updatedAddressRaw`** holds the completed street address when we find one on an official site. **`addressRaw` and `externalId` are unchanged** for stability.
- **`crm_enrich_changelog.json`** – Summary:
  - `parentWebsitesFilled`
  - `subsidiaryWebsitesFilled`
  - `locationsWithStreetAddressFilled`
  - `companiesStillMissingWebsite` (externalIds)
  - `locationsStillMissingStreetAddress` (externalIds)

## Rules

- **Official website**: Only accepted if (1) the domain is not a directory (D&B, ZoomInfo, LinkedIn, Wikipedia, chambers, etc.), and (2) the homepage contains the company name (or brand/legal name) in header/footer-like content.
- **Addresses**: Only from official domains (including subdomains like `suppliers.company.com`). Prefer JSON-LD `Organization`/`LocalBusiness` addresses; otherwise parse “Locations / Contact / Facilities / Offices” pages.
- **Location IDs**: If we fill a street address, we store it in **`metadata.updatedAddressRaw`** and do **not** change `addressRaw` or regenerate `externalId`.

## How to run

1. **Install dependencies** (from repo root):

   ```bash
   pnpm install
   ```

2. **Optional: SerpAPI key** for finding official websites:

   ```bash
   export SERPAPI_KEY=your_key
   ```

   Without it, website search is skipped (only existing websites are crawled for addresses).

3. **Run the script** (from repo root):

   ```bash
   pnpm run crm-enrich
   ```

   Or with tsx directly:

   ```bash
   npx tsx scripts/crm-enrich/run.ts
   ```

4. **Outputs** appear in the repo root:
   - `crm_parent_subsidiary_hierarchy_v5.json`
   - `crm_enrich_changelog.json`

## Implementation summary

- **Website finder** (`website-finder.ts`): SerpAPI query `"{company name} official website"`, reject directory domains, fetch homepage and verify company name in page content.
- **Crawler** (`crawler.ts`): BFS from homepage, same-domain only, max depth 3, max 200 pages; keyword paths: `locations`, `contact`, `facilities`, `plants`, `offices`, etc. Extracts addresses from JSON-LD and from page text.
- **Address matcher** (`address-matcher.ts`): Match extracted addresses to locations by city/state/zip; if multiple candidates, pick best string similarity to existing `addressRaw`.
- **Runner** (`run.ts`): Loads v4 and optional work queue, runs finder then crawler, applies matches into metadata, writes v5 and changelog.
