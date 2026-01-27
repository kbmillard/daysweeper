# Diagnostic & Fix Scripts

Quick scripts to diagnose and fix "prod ≠ local" issues.

## Usage

### 1. Doctor Script (Full Diagnostic)
```bash
pnpm doctor
# or
bash scripts/doctor.sh
```

Shows:
- Current git branch and commit SHA
- Local environment variables (redacted)
- Prisma migration status
- Vercel production environment (if linked)
- Live deployment SHA

### 2. Local Snapshot
```bash
pnpm snapshot:local
# or
bash scripts/snapshot-local.sh
```

Quick snapshot of your local state (git, env, prisma).

### 3. Compare Local vs Prod APIs
```bash
pnpm compare:prod
# or
tsx scripts/compare.ts
```

Compares API responses between localhost and production. Set env vars:
- `PROD_URL` (default: https://daysweeper.vercel.app)
- `LOCAL_URL` (default: http://localhost:3000)

### 4. Force Deploy Current Commit to Prod
```bash
# Make sure everything is committed
git add -A && git commit -m "sync local to prod"

# Deploy to production
vercel deploy --prod --confirm
```

### 5. Run Migrations on Prod DB
```bash
# Set prod DATABASE_URL temporarily
DATABASE_URL="<prod_db_url>" npx prisma migrate deploy
```

Or migrations run automatically after build via `postbuild` script.

### 6. Bulk Import Companies
```bash
curl -X POST http://localhost:3000/api/import/targets \
  -H 'content-type: application/json' \
  -d @/path/to/companies.json
```

Expected JSON format:
```json
[
  {
    "company": "Honda",
    "addressRaw": "123 Main St",
    "website": "https://honda.com",
    "phone": "555-1234",
    "email": "contact@honda.com",
    "accountState": "NEW_UNCONTACTED",
    "supplyTier": "TIER_1",
    "supplyGroup": "Automotive",
    "supplySubtype": "OEM"
  }
]
```

Or as `{items: [...]}` format.

## Common Issues & Fixes

### Issue: Route exists locally but not in prod
**Cause:** Different database  
**Fix:** 
1. Check `DATABASE_URL` in Vercel env vars
2. Run `DATABASE_URL="<prod>" pnpm prisma migrate deploy`
3. Redeploy

### Issue: API returns 404 in prod but 200 locally
**Cause:** Code not deployed or wrong branch  
**Fix:**
1. Check `pnpm doctor` output - compare commit SHAs
2. Ensure Vercel is watching the correct branch
3. `vercel deploy --prod --confirm`

### Issue: Missing env vars in prod
**Cause:** Not set in Vercel  
**Fix:**
1. `vercel env pull .env.vercel --environment=production`
2. Compare with local `.env.local`
3. Set missing vars: `vercel env add VARIABLE_NAME production`

## MCP Server

The MCP server in `mcp-server-daysweeper/` allows Cursor/IDE to query your API.

Configure in `.cursor/mcp.json` (already set up for localhost:3000).
