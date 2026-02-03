# Prepare All Company Pages from CRM Geocoded Hierarchy

This gets every company from `crm_parent_subsidiary_hierarchy_v4_geocoded.json` into the database so each has a page at **/dashboard/companies/{id}** (with locations and geocodes).

## Prerequisites

1. **Geocoded hierarchy file**  
   `crm_parent_subsidiary_hierarchy_v4_geocoded.json` in the repo root (from `pnpm run geocode-crm-hierarchy`).

2. **Database**  
   `DATABASE_URL` in `.env.local` pointing at your Postgres DB.

## Steps

### 1. Geocode the hierarchy (if not done)

```bash
pnpm run geocode-crm-hierarchy
```

Produces `crm_parent_subsidiary_hierarchy_v4_geocoded.json` with `latitude` / `longitude` on each location.

### 2. Import into the DB

```bash
pnpm run import-crm-geocoded
```

This script:

- Upserts all **companies** from `flat.companies` (by `externalId`).
- Sets **parent links** (`parentCompanyDbId`) from `parentExternalId`.
- Upserts all **locations** from `flat.locations` with `addressRaw`, `addressComponents`, **latitude**, **longitude**, and `companyId` pointing at the DB company.
- Adds a **placeholder location** for every company that had no locations in the JSON (e.g. parent-only companies). That way we get 1055 + ~332–351 = **1387–1406 locations** so every company has at least one.

After it finishes, every company in the hierarchy exists in the DB and has at least one location. Each company’s internal `id` is used for the detail page.

### 3. Open company pages

- **List:** `/dashboard/companies`  
  All imported companies appear in the table; row link goes to the detail page.

- **Detail:** `/dashboard/companies/{id}`  
  `{id}` is the internal UUID from the database (not `externalId`).  
  The table links use this automatically.

If you need to go from CRM `externalId` (e.g. `cmp_xxx`) to the page URL, look up the company by `externalId` and use its `id` for the link.

## Scripts

| Script | Purpose |
|--------|--------|
| `pnpm run geocode-crm-hierarchy` | Geocode all locations in hierarchy JSON → writes `*_geocoded.json` |
| `pnpm run import-crm-geocoded` | Import geocoded hierarchy into DB (companies + locations with lat/lng + placeholders) |

## Data flow

```
crm_parent_subsidiary_hierarchy_v4.json
  → geocode-crm-hierarchy.mjs (Nominatim + geocode.xyz)
  → crm_parent_subsidiary_hierarchy_v4_geocoded.json
  → import-crm-geocoded-hierarchy.ts (Prisma upserts + Pass 4 placeholders)
  → DB: Company + Location (with latitude, longitude)
  → App: /dashboard/companies, /dashboard/companies/[id]
```
