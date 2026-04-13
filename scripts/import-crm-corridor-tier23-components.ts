/**
 * CRM import: Tier 2/3 components batch (HSM ×2, Phoenix Closures, Pinnacle Plastics,
 * Midwest Stamping, American Wire Forming).
 *
 *   npx tsx scripts/import-crm-corridor-tier23-components.ts
 */

import { config } from 'dotenv';
import type { PrismaClient } from '@prisma/client';
import { runCrmSupplierImport, type CrmSupplierJson } from '../src/lib/crm-supplier-import';

config({ path: '.env.vercel' });
config({ path: '.env.local' });
config({ path: '.env' });

const ROWS: CrmSupplierJson[] = [
  {
    company: 'HSM Solutions',
    parentCompany: null,
    website: 'https://www.hsmsolutions.com',
    companyKey: 'hsmsolutions.com',
    companyId: 'cmp_72a1c8f4d211',
    parentCompanyId: null,
    locationId: 'loc_72b4e91f0c55',
    addressRaw: '221 Industrial Park Road, Hickory, NC 28601, US',
    addressComponents: {
      city: 'Hickory',
      state: 'NC',
      postal_code: '28601',
      country: 'US'
    },
    tier: 'Tier 3',
    segment: 'USA',
    supplyChainCategory: 'Tier_3',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Wire forming and seating components',
    industryKeywords: [
      'automotive',
      'wire forming',
      'seating components',
      'tier 2 support'
    ]
  },
  {
    company: 'HSM Solutions',
    parentCompany: null,
    website: 'https://www.hsmsolutions.com',
    companyKey: 'hsmsolutions.com',
    companyId: 'cmp_72a1c8f4d211',
    parentCompanyId: null,
    locationId: 'loc_72d3a65bc981',
    addressRaw: '600 5th Street SE, Hickory, NC 28602, US',
    addressComponents: {
      city: 'Hickory',
      state: 'NC',
      postal_code: '28602',
      country: 'US'
    },
    tier: 'Tier 3',
    segment: 'USA',
    supplyChainCategory: 'Tier_3',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Seating and interior component fabrication',
    industryKeywords: [
      'automotive',
      'seating',
      'fabrication',
      'tier 2 support'
    ]
  },
  {
    company: 'Phoenix Closures Inc.',
    parentCompany: null,
    website: 'https://www.phoenixclosures.com',
    companyKey: 'phoenixclosures.com',
    companyId: 'cmp_72b6f32a8a44',
    parentCompanyId: null,
    locationId: 'loc_72c1e7d4fb02',
    addressRaw: '9750 Commerce Circle, Greenwood, SC 29646, US',
    addressComponents: {
      city: 'Greenwood',
      state: 'SC',
      postal_code: '29646',
      country: 'US'
    },
    tier: 'Tier 3',
    segment: 'USA',
    supplyChainCategory: 'Tier_3',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Plastic molding components',
    industryKeywords: [
      'automotive',
      'plastic molding',
      'components',
      'tier 2 support'
    ]
  },
  {
    company: 'Pinnacle Plastics Inc.',
    parentCompany: null,
    website: 'https://www.pinnacleplastics.com',
    companyKey: 'pinnacleplastics.com',
    companyId: 'cmp_72f2b19d7c63',
    parentCompanyId: null,
    locationId: 'loc_72a9d5e3a211',
    addressRaw: '250 Industrial Drive, Lavonia, GA 30553, US',
    addressComponents: {
      city: 'Lavonia',
      state: 'GA',
      postal_code: '30553',
      country: 'US'
    },
    tier: 'Tier 3',
    segment: 'USA',
    supplyChainCategory: 'Tier_3',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Injection molded components',
    industryKeywords: [
      'automotive',
      'injection molding',
      'components',
      'Georgia corridor'
    ]
  },
  {
    company: 'Midwest Stamping LLC',
    parentCompany: null,
    website: 'https://www.midweststamping.com',
    companyKey: 'midweststamping.com',
    companyId: 'cmp_72e81b5a6d12',
    parentCompanyId: null,
    locationId: 'loc_72cf20e7d449',
    addressRaw: '1100 Industrial Drive, Bowling Green, KY 42101, US',
    addressComponents: {
      city: 'Bowling Green',
      state: 'KY',
      postal_code: '42101',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Metal stamping components',
    industryKeywords: [
      'automotive',
      'stamping',
      'metal forming',
      'Kentucky corridor'
    ]
  },
  {
    company: 'American Wire Forming Inc.',
    parentCompany: null,
    website: 'https://www.americanwireforming.com',
    companyKey: 'americanwireforming.com',
    companyId: 'cmp_72d0a4b2e981',
    parentCompanyId: null,
    locationId: 'loc_72ab7f20d5c8',
    addressRaw: '300 Industrial Parkway, Shelbyville, TN 37160, US',
    addressComponents: {
      city: 'Shelbyville',
      state: 'TN',
      postal_code: '37160',
      country: 'US'
    },
    tier: 'Tier 3',
    segment: 'USA',
    supplyChainCategory: 'Tier_3',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Wire forming and subcomponents',
    industryKeywords: [
      'automotive',
      'wire forming',
      'subcomponents',
      'tier 2 support'
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
  console.log('CRM import:', result, '(rowsRemappedToDbMaster = matched existing DB locations)');
  if (result.parentsLinked === 0 && result.rowsRemappedToDbMaster === 0) {
    console.warn(
      'No parentCompanyDbId links resolved (expected when parentCompanyId is null on all rows).'
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
