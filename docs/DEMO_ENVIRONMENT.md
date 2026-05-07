# Client demo environment (Daysweeper)

Use **one codebase**, **two deployments**, **two databases**. Do not rely on hiding data in the UI alone: API routes load full datasets from Postgres.

## Hosting choice

**Recommended:** a **second Vercel project** linked to the same Git repository, with Production environment variables pointing at a **dedicated demo Postgres** (`DEMO_DATABASE_URL` in your notes; in Vercel name it `DATABASE_URL` for that project).

**Alternative:** a long-lived **preview deployment** (pinned branch) with a **Preview**-scoped `DATABASE_URL` override to the demo database. Previews are easier to misconfigure when merging branches, so a separate project is clearer for client-facing demos.

## Provision an empty demo database

1. Create a new Postgres database (for example a Neon branch or new Neon project).
2. From this repo, point Prisma at it and apply migrations:

```bash
export DATABASE_URL="postgresql://…your-demo-db…"
pnpm exec prisma migrate deploy
pnpm exec prisma generate
```

Or use the npm script (loads `.env.demo` first if present):

```bash
cp .env.demo.example .env.demo
# edit .env.demo: set DATABASE_URL to the demo DB for this one-off command, or:
export DATABASE_URL="$DEMO_DATABASE_URL"
pnpm run demo:db:migrate
```

3. Confirm `pnpm exec prisma migrate status` reports applied migrations.

## Curate data (export from prod, import into demo)

1. Copy `.env.demo.example` to `.env.demo` and set `SOURCE_DATABASE_URL` (read-only user is ideal) and `DEMO_DATABASE_URL`.

2. Export a snapshot JSON (expands **parent companies** and **descendants** so `Company` / `Location` foreign keys stay valid):

```bash
pnpm run demo:export -- --companies "id1,id2,id3" --out exports/client-demo.json
```

Optional: include red-dot `MapPin` rows near exported locations (crude ±degree box):

```bash
pnpm run demo:export -- --companies "id1,id2" --out exports/client-demo.json --map-pins-deg 0.5
```

3. Import into the **demo** database only (this **truncates** all CRM companies and related rows via `TRUNCATE "Company" CASCADE`):

```bash
export DEMO_DATABASE_URL="postgresql://…demo…"
pnpm run demo:import -- --in exports/client-demo.json --reset-crm --truncate-map-pins --confirm I_UNDERSTAND_RESET
```

- Omit `--truncate-map-pins` if you want to keep existing `MapPin` / `HiddenDot` rows (for example you already trimmed them manually).
- Import **refuses** to run if `DEMO_DATABASE_URL` equals `DATABASE_URL` unless you set `DEMO_ALLOW_IMPORT_TO_PRIMARY_DATABASE=yes` (avoid this).

4. Optional LastLeg sync: if you copied map pins and use the shared canonical route:

```bash
export DATABASE_URL="$DEMO_DATABASE_URL"
node scripts/sync-shared-route-to-mappins.mjs
```

Treat exported JSON as **sensitive** (PII); do not commit it (see `.gitignore` for `/exports/`).

## Wire the demo deployment (Vercel + Clerk)

1. **Vercel:** Create the demo project (or configure Preview env), set `DATABASE_URL` / `DATABASE_URL_UNPOOLED` to the **demo** database, and copy non-database secrets from production as needed (Sentry, Mapbox, geocoding keys, etc.).
2. **Clerk:** Add the demo Vercel URL to **Allowed origins** and **Redirect URLs** for your Clerk application (or use a separate Clerk instance for demos).
3. Confirm the demo project never points `DATABASE_URL` at production.

## Smoke test checklist

Run automated counts against the demo DB:

```bash
export DEMO_DATABASE_URL="postgresql://…demo…"
pnpm run demo:verify
```

Then manually:

- Open `/map` and confirm pins and purple location density look appropriate.
- Open `/map/companies` (or `/dashboard/companies` if you use dashboard) and search one exported company.
- Open a company detail page and a location detail page; edit a harmless field and save.
- If you demo routing: open the route planner and confirm stops after `sync-shared-route-to-mappins` if applicable.

## Scripts reference

| Script | Purpose |
|--------|---------|
| `pnpm run demo:export` | `tsx scripts/demo-db-subset.ts export` |
| `pnpm run demo:import` | `tsx scripts/demo-db-subset.ts import` |
| `pnpm run demo:verify` | `tsx scripts/demo-db-subset.ts verify` |
| `pnpm run demo:db:migrate` | [`scripts/demo-db-migrate.mjs`](../scripts/demo-db-migrate.mjs) — `prisma migrate deploy` using `DATABASE_URL` or `DEMO_DATABASE_URL` from `.env.demo` |
