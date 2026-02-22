#!/usr/bin/env npx tsx
/**
 * Quick diagnostic: count WarehouseItem (bins) rows.
 * Run: npx tsx scripts/check-bins-count.ts
 * Uses .env or .env.vercel for DATABASE_URL.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [binCount, targetCount] = await Promise.all([
    prisma.warehouseItem.count(),
    prisma.target.count()
  ]);
  console.log('WarehouseItem (bins) count:', binCount);
  console.log('Target (leads) count:', targetCount);
  const sample = await prisma.warehouseItem.findMany({
    take: 3,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, bin: true, partNumber: true, updatedAt: true }
  });
  if (binCount > 0) {
    console.log('Bins sample (newest 3):');
    sample.forEach((r) =>
      console.log(`  - ${r.bin ?? '(null)'} | ${r.partNumber} | ${r.updatedAt}`)
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
