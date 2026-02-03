# CRM hierarchy v6 import (profiles and group locations)

Imports `crm_parent_subsidiary_hierarchy_v6_profiles_and_group_locations.json` into the Postgres DB (Company and Location models). Idempotent; uses batched upserts (300 per batch).

## Input file

Place the JSON at either:

- `./data/crm_parent_subsidiary_hierarchy_v6_profiles_and_group_locations.json`, or  
- `./crm_parent_subsidiary_hierarchy_v6_profiles_and_group_locations.json` (project root)

## Run command

```bash
pnpm run import-crm-v6
```

Or directly:

```bash
npx tsx scripts/importCrmV6.ts
```

## Requirements

- `DATABASE_URL` in `.env.local` (or `.env`)

## What the script does

1. **Pass 1** – Upsert **companies** by `externalId` from `flat.companies[]`  
   - Fields: name, website, companyKey, phone, email, tier, segment, category, subtypeGroup, subtype  
   - `Company.metadata` stores: `profile`, `keyProducts`, `industryKeywords`, `contactInfo` (plus `_importSource`, `_importedAt`)

2. **Pass 2** – Set **parent links**  
   - For each company with `parentExternalId`, set `parentCompanyDbId` (lookup parent by externalId) and `externalParentId`

3. **Pass 3** – Upsert **locations** by `externalId` from `flat.locations[]`  
   - Link to company via `companyExternalId`  
   - Fields: addressRaw, addressComponents, addressConfidence, latitude/longitude (if present)  
   - `Location.metadata` stores: `profile`, `capabilityTags`, `packagingSignals` (plus `_importSource`, `_importedAt`)

Safe to run multiple times (upsert by externalId).
