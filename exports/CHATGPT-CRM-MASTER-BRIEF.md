# ChatGPT: how to use `chatgpt-crm-master.json`

Attach **`chatgpt-crm-master.json`** as the canonical “already in CRM” list when generating **new** supplier rows. This file is regenerated from the Daysweeper database.

## Snapshot (this export)

- **`exportedAt`**: ISO timestamp at top of the JSON (source of truth for freshness).
- **`recordCount` / `stats.supplierRowsInThisFile`**: number of objects in **`suppliers`** (often **1685 location-backed rows + ~27 company-only rows** with no facility yet).
- **`stats.totalLocationRowsInDb`**: physical locations with IDs; should match rows that have a non-null **`locationId`**.

## Top-level shape

```json
{
  "exportedAt": "...",
  "mode": "all_external_ids",
  "stats": { ... },
  "recordCount": 1712,
  "suppliers": [ ... ]
}
```

The importer API also accepts `{ "suppliers": [ ... ] }` with the same objects.

## Per-row fields (dedupe contract)

| Field | Meaning |
|--------|--------|
| **`companyId`** | Stable company entity id (`cmp_` + 12 hex). **Never reuse** for a different legal entity. Same company, multiple locations → **same `companyId`**, different **`locationId`**. |
| **`locationId`** | Stable facility id (`loc_` + 12 hex), or **`null`** for a company-only stub (no address row yet). |
| **`parentCompanyId`** | Parent’s **`companyId`** when this row is a subsidiary; **`null`** if top-level. Resolved from CRM parent link or original GPT parent id. |
| **`companyKey`** | Canonical grouping key (usually registrable domain / normalized host). Use for fuzzy dedupe **after** id checks. |
| **`company`** | Display / legal-style name (not unique). |
| **`parentCompany`** | Parent display name when known (informational; **`parentCompanyId`** is authoritative). |
| **`website`** | Company website URL when known. |
| **`addressRaw`** | Single-line address for the **location**; **`null`** when **`locationId`** is **`null`**. |
| **`addressComponents`** | Structured pieces (e.g. `city`, `state`, `country`, `postal_code`) when available; may be **`null`**. |

## Rules for generating *new* rows (avoid duplicates)

1. **Primary keys**: If a candidate matches an existing **`companyId`** or **`locationId`**, treat it as an **update** to that entity, not a new row. Do **not** mint new ids for the same company/location.
2. **New company**: New **`companyId`** (`cmp_` + 12 random hex), unique vs file + any batch you output.
3. **New location** on an existing company: **Keep** existing **`companyId`**; assign a **new** **`locationId`** (`loc_` + 12 hex), unique vs file.
4. **Subsidiary**: Set **`parentCompanyId`** to the parent’s **`companyId`** from this file (or from your batch). Align **`companyKey`** / domain strategy with the parent where appropriate.
5. **`companyKey`**: Prefer a normalized domain (e.g. `example.com`); keep stable for the same corporate group when deduping.

## Daysweeper import — what the app actually reads

The importer **only** maps these supplier fields into the database (existing Company / Location columns + the same small `metadata` shape as always: `industryKeywords`, `capabilityTags`, `keyProducts`, `_importedAt`, `_importSource`):

- `companyId`, `locationId`, `parentCompanyId`, `companyKey`
- `company`, `website`, `phone`, `contactInfo`, `segment`, `tier`
- `supplyChainCategory`, `supplyChainSubtype`, `supplyChainSubtypeGroup`
- `addressRaw`, `addressComponents`
- `industryKeywords`, `capabilityTags`, `keyProducts`

**Any other keys** on each object (for example `parentCompany`, `addressConfidence`, `legacyJson`, or anything else you keep for your own prompts) are **ignored** by Daysweeper on import so your **JSON shape can stay fixed** for ChatGPT consistency.

After the human refreshes data in-app, they can re-run the export so this file stays the single source of truth for GPT.
