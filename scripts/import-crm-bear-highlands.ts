/**
 * CRM import: Bear Diversified, Inc. (parent) + Highlands Diversified Services (3 sites).
 *
 *   npx tsx scripts/import-crm-bear-highlands.ts
 */

import { config } from 'dotenv';
import type { PrismaClient } from '@prisma/client';
import { runCrmSupplierImport, type CrmSupplierJson } from '../src/lib/crm-supplier-import';

config({ path: '.env.vercel' });
config({ path: '.env.local' });
config({ path: '.env' });

const ROWS: CrmSupplierJson[] = [
  {
    company: 'Bear Diversified, Inc.',
    parentCompany: null,
    website: 'https://www.beardiversified.com/',
    companyKey: 'beardiversified.com',
    companyId: 'cmp_72p5d1a40ef8',
    parentCompanyId: null,
    locationId: 'loc_72p1b84d9c51',
    addressRaw: '4580 East 71st Street, Cuyahoga Heights, OH 44125, US',
    addressComponents: {
      city: 'Cuyahoga Heights',
      state: 'OH',
      postal_code: '44125',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Engineered structural products / stamped and welded assemblies',
    industryKeywords: [
      'automotive',
      'metal stampings',
      'welded assemblies',
      'electro-mechanical assemblies',
      'holding company'
    ]
  },
  {
    company: 'Highlands Diversified Services',
    parentCompany: 'Bear Diversified, Inc.',
    website: 'https://www.hds-usa.com/',
    companyKey: 'hds-usa.com',
    companyId: 'cmp_726c83df14a7',
    parentCompanyId: 'cmp_72p5d1a40ef8',
    locationId: 'loc_72e91ca4d6b2',
    addressRaw: '250 Westinghouse Drive, London, KY 40741, US',
    addressComponents: {
      city: 'London',
      state: 'KY',
      postal_code: '40741',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Metal stamping / fabrication / welding / electro-mechanical assembly',
    industryKeywords: [
      'automotive',
      'metal stamping',
      'fabrication',
      'welding',
      'electro-mechanical assembly'
    ]
  },
  {
    company: 'Highlands Diversified Services',
    parentCompany: 'Bear Diversified, Inc.',
    website: 'https://www.hds-usa.com/',
    companyKey: 'hds-usa.com',
    companyId: 'cmp_726c83df14a7',
    parentCompanyId: 'cmp_72p5d1a40ef8',
    locationId: 'loc_72hds440tb9a',
    addressRaw: '440 Tobacco Rd, London, KY 40741, US',
    addressComponents: {
      city: 'London',
      state: 'KY',
      postal_code: '40741',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Warehouse / distribution / pack-out support',
    industryKeywords: [
      'automotive',
      'warehouse',
      'distribution',
      'pack-out',
      'support facility'
    ]
  },
  {
    company: 'Highlands Diversified Services',
    parentCompany: 'Bear Diversified, Inc.',
    website: 'https://www.hds-usa.com/',
    companyKey: 'hds-usa.com',
    companyId: 'cmp_726c83df14a7',
    parentCompanyId: 'cmp_72p5d1a40ef8',
    locationId: 'loc_72hds304ann1',
    addressRaw: '304 Carpenter Drive, Annville, KY 40402, US',
    addressComponents: {
      city: 'Annville',
      state: 'KY',
      postal_code: '40402',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Assembly / testing support',
    industryKeywords: [
      'automotive',
      'assembly',
      'testing',
      'technical center',
      'support facility'
    ]
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
  const result = await runCrmSupplierImport(db, ROWS);
  console.log('CRM import:', result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
