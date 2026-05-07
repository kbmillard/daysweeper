#!/usr/bin/env node
/**
 * Run `prisma migrate deploy` against DATABASE_URL or DEMO_DATABASE_URL from .env.demo / .env.
 * Pre-set DATABASE_URL in the child env so prisma.config.ts sees it before optional .env.vercel fills gaps.
 */
import { spawnSync } from 'child_process';
import { join } from 'path';
import { config } from 'dotenv';

config({ path: join(process.cwd(), '.env.demo') });
config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

const url = process.env.DATABASE_URL || process.env.DEMO_DATABASE_URL;
if (!url) {
  console.error('demo-db-migrate: set DATABASE_URL or DEMO_DATABASE_URL (e.g. in .env.demo)');
  process.exit(1);
}

process.env.DATABASE_URL = url;
if (!process.env.DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URL_UNPOOLED = url;
}

const prismaBin = join(process.cwd(), 'node_modules', '.bin', 'prisma');
const r = spawnSync(prismaBin, ['migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
  cwd: process.cwd()
});
process.exit(r.status ?? 1);
