# Import suppliers (JSON)

Idempotent importer for supplier JSON files produced by the supplier sweep. Reads one or more JSON files (arrays of supplier entries), de-dupes by `locationId` or `(companyKey + normalized addressRaw)`, then upserts **Company** and **Location** with parent linking.

## Requirements

- `DATABASE_URL` in `.env.local` (or `.env`)
- JSON files: array of objects with at least `company`, `addressRaw`; optional `companyId`, `locationId`, `parentCompanyId`, `website`, `tier`, `segment`, `addressComponents`, etc.

## Usage

```bash
# Single file (paths relative to project root)
npx tsx scripts/importSuppliers.ts --files JSON/round2/new_entries.json

# Multiple files (comma-separated)
npx tsx scripts/importSuppliers.ts --files data/new_entries_round44_TX_suppliers_only.json,data/new_entries_round45_TX_suppliers_only.json

# With org and user (optional)
npx tsx scripts/importSuppliers.ts --files JSON/round2/file.json --orgId ORG --userId USER

# Dry run (no DB writes; still logs what would happen)
npx tsx scripts/importSuppliers.ts --files JSON/round2/file.json --dryRun
```

## Options

| Option   | Description |
|----------|-------------|
| `--files` | Comma-separated paths to JSON files (required) |
| `--orgId` | Optional org id to set on created/updated companies |
| `--userId` | Optional user id to set on created/updated companies |
| `--dryRun` | Log actions only; do not write to the database |

## Output

- **createdCompanies** / **updatedCompanies** – companies upserted by `externalId`
- **createdLocations** / **updatedLocations** – locations upserted by `externalId`
- **parentLinksSet** – companies linked to parent via `parentCompanyDbId`

**Geocode JSON first (so locations hit the map):** run `geocodeSupplierJson.ts` to add `latitude`/`longitude` to each entry, then import the resulting file:

```bash
npx tsx scripts/geocodeSupplierJson.ts --input JSON/round2/file.json
npx tsx scripts/importSuppliers.ts --files JSON/round2/file_geocoded.json
```

Alternatively, after import without coords, run `POST /api/geocode/bulk` or `pnpm run geocode:apple` to geocode in the DB.
