#!/usr/bin/env bash
set -euo pipefail

echo "=== GIT SNAPSHOT ==="
echo "Branch: $(git branch --show-current)"
echo "Commit: $(git rev-parse --short HEAD)"
echo "Full SHA: $(git rev-parse HEAD)"
echo ""
echo "Remote:"
git remote -v | head -n 2
echo ""

echo "=== ENV SNAPSHOT ==="
if [ -f .env.local ]; then
  echo ".env.local exists"
  grep -E "NEXT_PUBLIC_SITE_URL|MAPBOX_TOKEN|NEXT_PUBLIC_MAPBOX_TOKEN|DATABASE_URL|CLERK_" .env.local 2>/dev/null | sed -E 's/(=).*/=\[REDACTED]/' || echo "No matches"
fi
if [ -f .env ]; then
  echo ".env exists"
  grep -E "NEXT_PUBLIC_SITE_URL|MAPBOX_TOKEN|NEXT_PUBLIC_MAPBOX_TOKEN|DATABASE_URL|CLERK_" .env 2>/dev/null | sed -E 's/(=).*/=\[REDACTED]/' || echo "No matches"
fi
echo ""

echo "=== PRISMA STATUS ==="
pnpm prisma migrate status || echo "Failed to check"
echo ""

echo "=== WORKING DIRECTORY ==="
pwd
