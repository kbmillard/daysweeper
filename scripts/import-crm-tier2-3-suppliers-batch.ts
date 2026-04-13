/**
 * CRM import: B&H Tool ×2, C&S Plastics, LexPlastics, Master Mfg, Elite Mold, Marchel.
 *
 *   npx tsx scripts/import-crm-tier2-3-suppliers-batch.ts
 */

import { config } from 'dotenv';
import type { PrismaClient } from '@prisma/client';
import { runCrmSupplierImport, type CrmSupplierJson } from '../src/lib/crm-supplier-import';

config({ path: '.env.vercel' });
config({ path: '.env.local' });
config({ path: '.env' });

const ROWS: CrmSupplierJson[] = [
  {
    company: 'B&H Tool Works, Inc.',
    parentCompany: null,
    website: 'https://bhtoolworks.com/',
    companyKey: 'bhtoolworks.com',
    companyId: 'cmp_72bht9e41a2d',
    parentCompanyId: null,
    locationId: 'loc_72bhtb8f1031',
    addressRaw: '1785 Lancaster Rd, Richmond, KY 40475, US',
    addressComponents: {
      city: 'Richmond',
      state: 'KY',
      postal_code: '40475',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Metal stamping / tooling / laser cutting',
    industryKeywords: [
      'automotive',
      'tier 2',
      'metal stamping',
      'tooling',
      'laser cutting'
    ]
  },
  {
    company: 'B&H Tool Works, Inc.',
    parentCompany: null,
    website: 'https://bhtoolworks.com/',
    companyKey: 'bhtoolworks.com',
    companyId: 'cmp_72bht9e41a2d',
    parentCompanyId: null,
    locationId: 'loc_72bhtd2a94c8',
    addressRaw: '83 Henderson Dr, Mount Vernon, KY 40456, US',
    addressComponents: {
      city: 'Mount Vernon',
      state: 'KY',
      postal_code: '40456',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Metal stamping / tooling / laser cutting',
    industryKeywords: [
      'automotive',
      'tier 2',
      'metal stamping',
      'tooling',
      'Kentucky corridor'
    ]
  },
  {
    company: 'C&S Plastics LLC',
    parentCompany: null,
    website: 'https://www.csplasticsllc.com/',
    companyKey: 'csplasticsllc.com',
    companyId: 'cmp_72csp51a0b77',
    parentCompanyId: null,
    locationId: 'loc_72cspfa61d24',
    addressRaw: '24 Franke Blvd, Fayetteville, TN 37334, US',
    addressComponents: {
      city: 'Fayetteville',
      state: 'TN',
      postal_code: '37334',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Plastic injection molding',
    industryKeywords: [
      'automotive',
      'tier 2',
      'plastic injection molding',
      'assembly',
      'IATF-oriented supply'
    ]
  },
  {
    company: 'LexPlastics, Inc.',
    parentCompany: null,
    website: 'https://www.lexplastics.com/',
    companyKey: 'lexplastics.com',
    companyId: 'cmp_72lex57fa21c',
    parentCompanyId: null,
    locationId: 'loc_72lex1ab7d64',
    addressRaw: '1086 Brentwood Ct, Lexington, KY 40511, US',
    addressComponents: {
      city: 'Lexington',
      state: 'KY',
      postal_code: '40511',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Injection molding / assemblies / interior trim components',
    industryKeywords: [
      'automotive',
      'tier 2',
      'injection molding',
      'assemblies',
      'interior trim'
    ]
  },
  {
    company: 'Master Manufacturing Co., Inc.',
    parentCompany: null,
    website: 'https://mastermfg.com/',
    companyKey: 'mastermfg.com',
    companyId: 'cmp_72mmm4a11f86',
    parentCompanyId: null,
    locationId: 'loc_72mmm9bf4a21',
    addressRaw: '4703 Ohara Drive, Evansville, IN 47711, US',
    addressComponents: {
      city: 'Evansville',
      state: 'IN',
      postal_code: '47711',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Metal stampings / clips / heat treat / plating',
    industryKeywords: [
      'automotive',
      'metal stamping',
      'clips',
      'heat treatment',
      'zinc electroplating',
      'IATF 16949'
    ]
  },
  {
    company: 'Elite Mold & Engineering, Inc.',
    parentCompany: null,
    website: 'https://www.teameliteonline.com/',
    companyKey: 'teameliteonline.com',
    companyId: 'cmp_72elite3f0b6a',
    parentCompanyId: null,
    locationId: 'loc_72elite81da43',
    addressRaw: '51548 Filomena Drive, Shelby Township, MI 48315, US',
    addressComponents: {
      city: 'Shelby Township',
      state: 'MI',
      postal_code: '48315',
      country: 'US'
    },
    tier: 'Tier 3',
    segment: 'USA',
    supplyChainCategory: 'Tier_3',
    supplyChainSubtypeGroup: 'Engineering',
    supplyChainSubtype: 'Injection molds / low-volume molding / prototype support',
    industryKeywords: [
      'automotive',
      'tooling',
      'prototype molding',
      'low-volume molding',
      'PPAP support'
    ]
  },
  {
    company: 'Marchel Industries Inc.',
    parentCompany: null,
    website: 'https://marchelindustries.com/',
    companyKey: 'marchelindustries.com',
    companyId: 'cmp_72mar1d04bc5',
    parentCompanyId: null,
    locationId: 'loc_72mar7e9f2d0',
    addressRaw: '100 South West Dr, Spartanburg, SC 29303, US',
    addressComponents: {
      city: 'Spartanburg',
      state: 'SC',
      postal_code: '29303',
      country: 'US'
    },
    tier: 'Tier 3',
    segment: 'USA',
    supplyChainCategory: 'Tier_3',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Injection molding / machining / OEM support',
    industryKeywords: [
      'automotive-adjacent',
      'injection molding',
      'machining',
      'OEM support',
      'Spartanburg corridor'
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
