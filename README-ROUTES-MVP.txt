Routes Builder MVP Patch (APIs + hooks + pages + outcomes + analytics)

1) Install deps:
   pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/modifiers date-fns

2) Prisma schema: ensure you have models Route, RouteStop, StopOutcome (see earlier spec).
   Then run:
   pnpm prisma generate
   pnpm prisma migrate dev -n add_routes_models

   (Optional) Add rollup columns to Target:
     lastOutcome StopOutcome?
     lastVisitedAt DateTime?
     visitedCount Int @default(0)
     noAnswerCount Int @default(0)
     wrongAddressCount Int @default(0)
     followUpCount Int @default(0)
   Migrate again:
   pnpm prisma migrate dev -n add_target_outcome_rollups

3) Place files:
   - src/lib/routes.ts
   - app/api/routes/route.ts
   - app/api/routes/[id]/route.ts
   - app/api/routes/[id]/stops/route.ts
   - app/api/routes/stops/[stopId]/route.ts
   - app/api/analytics/overview/route.ts (replaces with completion & byDay outcomes)
   - app/routes/page.tsx
   - app/routes/[id]/page.tsx
   - components/routes/OutcomeButtons.tsx

4) Usage:
   - /routes → create/open/delete routes
   - /routes/:id → add companies to right pane, drag to order, Save Order
   - In your stop rows, you can render <OutcomeButtons stopId={stop.id} /> to mark outcomes.

5) Analytics:
   - Dashboard completion rate and by-day chart now read from RouteStop.visitedAt/outcome.

6) Deploy:
   - git add -A && git commit -m "Routes MVP + outcomes + analytics"
   - vercel (or your flow) → then run: npx prisma migrate deploy

Notes:
 - Outcome mirroring to Target is attempted in the API but skipped if rollup columns do not exist yet.
 - Add DB indexes later.
