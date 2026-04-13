/**
 * Import synthetic suppliers as Company + Location (purple pins / company pages).
 * Removes mistaken Target rows from an earlier targets import (same locationIds).
 *
 *   npx tsx scripts/import-crm-synthetic-r70-r71.ts
 */

import { config } from 'dotenv';
import type { PrismaClient } from '@prisma/client';
import { runCrmSupplierImport, type CrmSupplierJson } from '../src/lib/crm-supplier-import';

config({ path: '.env.vercel' });
config({ path: '.env.local' });
config({ path: '.env' });

/** Targets incorrectly created via POST /api/import/targets (same ids as location externalIds). */
const STALE_TARGET_IDS = [
  'loc_r70_001',
  'loc_r70_002',
  'loc_r71_001',
  'loc_r71_002',
  'loc_r71_003',
  'loc_r71_004',
  'loc_r71_005'
];

const SUPPLIERS: CrmSupplierJson[] = [
  {
    company: 'Synthetic Auto Components',
    website: 'https://www.synthetic001-auto.com',
    companyKey: 'syntheticautocomponents',
    companyId: 'cmp_r70_001',
    locationId: 'loc_r70_001',
    addressRaw: '1001 Industrial Park Dr, Fort Smith, AR 72916, USA',
    addressComponents: { city: 'Fort Smith', state: 'AR', postal_code: '72916', country: 'US' },
    tier: 'Tier 2',
    supplyChainCategory: 'Metal Forming',
    supplyChainSubtypeGroup: 'Stamping',
    supplyChainSubtype: 'Automotive Steel Stamping',
    industryKeywords: ['automotive', 'stamping']
  },
  {
    company: 'Synthetic Auto Components',
    website: 'https://www.synthetic002-auto.com',
    companyKey: 'syntheticautocomponents',
    companyId: 'cmp_r70_002',
    locationId: 'loc_r70_002',
    addressRaw: '1002 Industrial Park Dr, Springfield, MO 65802, USA',
    addressComponents: { city: 'Springfield', state: 'MO', postal_code: '65802', country: 'US' },
    tier: 'Tier 1',
    supplyChainCategory: 'Assemblies',
    supplyChainSubtypeGroup: 'Module',
    supplyChainSubtype: 'Driveline Module Assembly',
    industryKeywords: ['automotive', 'assembly']
  },
  {
    company: 'Midwest Component Solutions',
    website: 'https://www.midwestcomponentsolutions.com',
    companyKey: 'midwestcomponentsolutions',
    companyId: 'cmp_r71_001',
    locationId: 'loc_r71_001',
    addressRaw: '2100 Industrial Blvd, Fort Smith, AR 72916, USA',
    addressComponents: { city: 'Fort Smith', state: 'AR', postal_code: '72916', country: 'US' },
    tier: 'Tier 2',
    supplyChainCategory: 'Metal Forming',
    supplyChainSubtypeGroup: 'Stamping',
    supplyChainSubtype: 'Automotive Steel Stamping',
    industryKeywords: ['automotive', 'stamping', 'metal']
  },
  {
    company: 'Ozark Precision Molding',
    website: 'https://www.ozarkprecisionmolding.com',
    companyKey: 'ozarkprecisionmolding',
    companyId: 'cmp_r71_002',
    locationId: 'loc_r71_002',
    addressRaw: '1450 Enterprise Ave, Springfield, MO 65802, USA',
    addressComponents: { city: 'Springfield', state: 'MO', postal_code: '65802', country: 'US' },
    tier: 'Tier 2',
    supplyChainCategory: 'Plastics',
    supplyChainSubtypeGroup: 'Injection Molding',
    supplyChainSubtype: 'Automotive Injection Molding',
    industryKeywords: ['automotive', 'plastics', 'molding']
  },
  {
    company: 'Hoosier Tool & Die Group',
    website: 'https://www.hoosiertooldiegroup.com',
    companyKey: 'hoosiertooldiegroup',
    companyId: 'cmp_r71_003',
    locationId: 'loc_r71_003',
    addressRaw: '890 Tooling Dr, Elkhart, IN 46516, USA',
    addressComponents: { city: 'Elkhart', state: 'IN', postal_code: '46516', country: 'US' },
    tier: 'Tier 2',
    supplyChainCategory: 'Tooling',
    supplyChainSubtypeGroup: 'Tool & Die',
    supplyChainSubtype: 'Automotive Tool & Die Manufacturing',
    industryKeywords: ['automotive', 'tooling', 'die']
  },
  {
    company: 'Great Lakes Casting Technologies',
    website: 'https://www.greatlakescastingtech.com',
    companyKey: 'greatlakescastingtechnologies',
    companyId: 'cmp_r71_004',
    locationId: 'loc_r71_004',
    addressRaw: '3200 Foundry Way, Lansing, MI 48906, USA',
    addressComponents: { city: 'Lansing', state: 'MI', postal_code: '48906', country: 'US' },
    tier: 'Tier 2',
    supplyChainCategory: 'Casting',
    supplyChainSubtypeGroup: 'Aluminum',
    supplyChainSubtype: 'Automotive Aluminum Casting',
    industryKeywords: ['automotive', 'casting', 'aluminum']
  },
  {
    company: 'Arkansas Automotive Fastener Works',
    website: 'https://www.arkansasautofastenerworks.com',
    companyKey: 'arkansasautofastenerworks',
    companyId: 'cmp_r71_005',
    locationId: 'loc_r71_005',
    addressRaw: '1125 Bolt Street, Little Rock, AR 72206, USA',
    addressComponents: { city: 'Little Rock', state: 'AR', postal_code: '72206', country: 'US' },
    tier: 'Tier 2',
    supplyChainCategory: 'Fasteners',
    supplyChainSubtypeGroup: 'Cold Forming',
    supplyChainSubtype: 'Automotive Fastener Manufacturing',
    industryKeywords: ['automotive', 'fasteners', 'cold forming']
  }
];

let prisma: PrismaClient | null = null;

async function getPrisma(): Promise<PrismaClient> {
  if (prisma) return prisma;
  const mod = await import('../src/lib/prisma');
  prisma = mod.prisma as PrismaClient;
  return prisma;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const db = await getPrisma();

  const del = await db.target.deleteMany({
    where: { id: { in: STALE_TARGET_IDS } }
  });
  if (del.count > 0) {
    console.log('Removed stale Target rows:', del.count, STALE_TARGET_IDS.join(', '));
  }

  const result = await runCrmSupplierImport(db, SUPPLIERS);
  console.log('CRM import:', result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
