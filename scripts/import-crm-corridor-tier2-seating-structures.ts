/**
 * CRM import: Tier 2 seating / structures / exteriors batch (Magna, Adient, Martinrea, OPmobility,
 * Forvia/Faurecia, Yanfeng, Tower, Lear, TS Tech).
 *
 *   npx tsx scripts/import-crm-corridor-tier2-seating-structures.ts
 */

import { config } from 'dotenv';
import type { PrismaClient } from '@prisma/client';
import { runCrmSupplierImport, type CrmSupplierJson } from '../src/lib/crm-supplier-import';

config({ path: '.env.vercel' });
config({ path: '.env.local' });
config({ path: '.env' });

const ROWS: CrmSupplierJson[] = [
  {
    company: 'Magna Seating of America, Inc.',
    parentCompany: 'Magna International',
    website: 'https://www.magna.com/company/company-information/global-locations',
    companyKey: 'magna.com',
    companyId: 'cmp_72c8a7d51b29',
    parentCompanyId: 'cmp_72p8c11aa402',
    locationId: 'loc_72f41e92c3a1',
    addressRaw: '1014 John Dodd Road, Spartanburg, SC 29303, US',
    addressComponents: {
      city: 'Spartanburg',
      state: 'SC',
      postal_code: '29303',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Seating systems and subassemblies',
    industryKeywords: [
      'automotive',
      'seating',
      'interior systems',
      'Spartanburg BMW ecosystem'
    ]
  },
  {
    company: 'Adient US LLC',
    parentCompany: 'Adient plc',
    website: 'https://www.adient.com/global-locations',
    companyKey: 'adient.com',
    companyId: 'cmp_728a63de4f81',
    parentCompanyId: 'cmp_72p37e0d9a11',
    locationId: 'loc_72b9c5a7d112',
    addressRaw: '100 Adient Drive, Lexington, TN 38351, US',
    addressComponents: {
      city: 'Lexington',
      state: 'TN',
      postal_code: '38351',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Seat structures and foam assemblies',
    industryKeywords: ['automotive', 'seating', 'foam', 'interior assembly']
  },
  {
    company: 'Martinrea Industries USA Inc.',
    parentCompany: 'Martinrea International',
    website: 'https://www.martinrea.com/locations/',
    companyKey: 'martinrea.com',
    companyId: 'cmp_729f1a4ce721',
    parentCompanyId: 'cmp_72p6d9b3c441',
    locationId: 'loc_72ccfa903e88',
    addressRaw: '3900 Hal Rogers Parkway, London, KY 40741, US',
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
    supplyChainSubtype: 'Metal forming and fluid management components',
    industryKeywords: [
      'automotive',
      'metal forming',
      'structural components',
      'Kentucky corridor'
    ]
  },
  {
    company: 'Plastic Omnium Auto Exteriors LLC',
    parentCompany: 'OPmobility (Plastic Omnium)',
    website: 'https://www.opmobility.com/en/locations/',
    companyKey: 'opmobility.com',
    companyId: 'cmp_72a91e7d8f52',
    parentCompanyId: 'cmp_72p19afc32d7',
    locationId: 'loc_72d7f82b4c01',
    addressRaw: '100 Plastic Omnium Drive, Greer, SC 29651, US',
    addressComponents: {
      city: 'Greer',
      state: 'SC',
      postal_code: '29651',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Exterior plastic body components',
    industryKeywords: [
      'automotive',
      'exterior systems',
      'plastic molding',
      'BMW supplier network'
    ]
  },
  {
    company: 'Faurecia Interior Systems USA LLC',
    parentCompany: 'Forvia',
    website: 'https://www.forvia.com/en/worldwide-presence',
    companyKey: 'forvia.com',
    companyId: 'cmp_72b14f6dc332',
    parentCompanyId: 'cmp_72p0a5ce8931',
    locationId: 'loc_72ed05c0b472',
    addressRaw: '200 Faurecia Drive, Chattanooga, TN 37421, US',
    addressComponents: {
      city: 'Chattanooga',
      state: 'TN',
      postal_code: '37421',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Interior modules and cockpit systems',
    industryKeywords: [
      'automotive',
      'interior systems',
      'cockpit modules',
      'Volkswagen Chattanooga ecosystem'
    ]
  },
  {
    company: 'Yanfeng US Automotive Interior Systems LLC',
    parentCompany: 'Yanfeng Automotive Interiors',
    website: 'https://www.yanfeng.com/en/locations',
    companyKey: 'yanfeng.com',
    companyId: 'cmp_72d9f2c17a55',
    parentCompanyId: 'cmp_72p8e1d4ab02',
    locationId: 'loc_72af82de9133',
    addressRaw: '100 Automotive Drive, Highland Park, MI 48203, US',
    addressComponents: {
      city: 'Highland Park',
      state: 'MI',
      postal_code: '48203',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Interior trim and cockpit modules',
    industryKeywords: [
      'automotive',
      'interior trim',
      'cockpit',
      'Detroit supplier base'
    ]
  },
  {
    company: 'Tower Automotive Operations USA I LLC',
    parentCompany: 'Tower International',
    website: 'https://www.towerinternational.com/locations/',
    companyKey: 'towerinternational.com',
    companyId: 'cmp_72a01b7c93f4',
    parentCompanyId: 'cmp_72pde41caa21',
    locationId: 'loc_72e64a3a0df5',
    addressRaw: '1 Tower Drive, Livonia, MI 48150, US',
    addressComponents: {
      city: 'Livonia',
      state: 'MI',
      postal_code: '48150',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Structural stampings and assemblies',
    industryKeywords: ['automotive', 'stamping', 'structures', 'body components']
  },
  {
    company: 'Lear Corporation Seating Systems',
    parentCompany: 'Lear Corporation',
    website: 'https://www.lear.com/locations',
    companyKey: 'lear.com',
    companyId: 'cmp_72c91a4f8e72',
    parentCompanyId: 'cmp_72p72a19e1e0',
    locationId: 'loc_72bd73a0cf28',
    addressRaw: '123 Lear Drive, Hammond, IN 46320, US',
    addressComponents: {
      city: 'Hammond',
      state: 'IN',
      postal_code: '46320',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Seating systems and assemblies',
    industryKeywords: [
      'automotive',
      'seating',
      'interior systems',
      'Indiana corridor'
    ]
  },
  {
    company: 'TS Tech Americas Inc.',
    parentCompany: 'TS Tech Co., Ltd.',
    website: 'https://www.tstech.com/en/global/network/',
    companyKey: 'tstech.com',
    companyId: 'cmp_72df8b37a5d0',
    parentCompanyId: 'cmp_72p18c47aa62',
    locationId: 'loc_72f3d52a0b66',
    addressRaw: '100 TS Tech Drive, New Castle, IN 47362, US',
    addressComponents: {
      city: 'New Castle',
      state: 'IN',
      postal_code: '47362',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Seat frames and structures',
    industryKeywords: [
      'automotive',
      'seat frames',
      'structures',
      'Honda supplier network'
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
      'No parentCompanyDbId links resolved. Import matches parent by Company.externalId first, then companyKey+parent name against existing rows.'
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
