#!/usr/bin/env bash
set -euo pipefail

echo "=== GIT ==="
git branch --show-current
git rev-parse --short HEAD
echo "Remote:"
git remote -v | head -n 2

echo ""
echo "=== ENV (local) ==="
if [ -f .env.local ]; then
  grep -E "NEXT_PUBLIC_SITE_URL|MAPBOX_TOKEN|NEXT_PUBLIC_MAPBOX_TOKEN|DATABASE_URL|CLERK_" .env.local 2>/dev/null | sed -E 's/(=).*/=\[REDACTED]/' || echo "No matches in .env.local"
fi
if [ -f .env ]; then
  grep -E "NEXT_PUBLIC_SITE_URL|MAPBOX_TOKEN|NEXT_PUBLIC_MAPBOX_TOKEN|DATABASE_URL|CLERK_" .env 2>/dev/null | sed -E 's/(=).*/=\[REDACTED]/' || echo "No matches in .env"
fi

echo ""
echo "=== Prisma status ==="
pnpm prisma migrate status || echo "Failed to check migrate status"

echo ""
echo "=== Vercel (prod env) ==="
if command -v vercel &> /dev/null; then
  vercel env pull .env.vercel --environment=production 2>/dev/null || echo "Failed to pull Vercel env (may need: vercel link)"
  if [ -f .env.vercel ]; then
    grep -E "NEXT_PUBLIC_SITE_URL|MAPBOX_TOKEN|NEXT_PUBLIC_MAPBOX_TOKEN|DATABASE_URL|CLERK_" .env.vercel 2>/dev/null | sed -E 's/(=).*/=\[REDACTED]/' || echo "No matches in .env.vercel"
  fi
  
  echo ""
  echo "=== Live Deployment SHA ==="
  vercel ls --prod --limit=1 2>/dev/null | head -n 5 || echo "Failed to list deployments (may need: vercel link)"
else
  echo "Vercel CLI not found. Install with: npm i -g vercel"
fi
