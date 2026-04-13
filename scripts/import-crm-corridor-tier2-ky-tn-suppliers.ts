/**
 * CRM import: Tier 2 KY/TN suppliers (B&H Tool, C&S Plastics, Highlands/Bear, Lincoln Mfg,
 * Star Mfg, Precision Molding, Jones Plastic ×2, Southeast Molding, SST).
 *
 *   npx tsx scripts/import-crm-corridor-tier2-ky-tn-suppliers.ts
 */

import { config } from 'dotenv';
import type { PrismaClient } from '@prisma/client';
import { runCrmSupplierImport, type CrmSupplierJson } from '../src/lib/crm-supplier-import';

config({ path: '.env.vercel' });
config({ path: '.env.local' });
config({ path: '.env' });

const ROWS: CrmSupplierJson[] = [
  {
    company: 'B&H Tool Works',
    parentCompany: null,
    website: 'https://bhtoolworks.com/',
    companyKey: 'bhtoolworks.com',
    companyId: 'cmp_72d11b48a203',
    parentCompanyId: null,
    locationId: 'loc_72b9f1d5ac40',
    addressRaw: '1555 Lisle Industrial Ave, Lexington, KY 40511, US',
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
    supplyChainSubtype: 'Metal stamping / tooling',
    industryKeywords: [
      'automotive',
      'tier 2',
      'metal stamping',
      'progressive dies',
      'tooling'
    ]
  },
  {
    company: 'C&S Plastics LLC',
    parentCompany: null,
    website: 'https://www.csplasticsllc.com/',
    companyKey: 'csplasticsllc.com',
    companyId: 'cmp_72f40ae8c116',
    parentCompanyId: null,
    locationId: 'loc_72c44b9f02de',
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
    supplyChainSubtype: 'Injection molding',
    industryKeywords: [
      'automotive',
      'tier 2',
      'plastic injection molding',
      'assembly'
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
    supplyChainSubtype: 'Metal stamping / fabrication / electro-mechanical assembly',
    industryKeywords: [
      'automotive',
      'metal stamping',
      'fabrication',
      'welding',
      'electro-mechanical assembly'
    ]
  },
  {
    company: 'Lincoln Manufacturing USA, LLC',
    parentCompany: null,
    website: 'https://www.lincolnmfg.com/',
    companyKey: 'lincolnmfg.com',
    companyId: 'cmp_72a7d2f40b91',
    parentCompanyId: null,
    locationId: 'loc_72d5baf1e944',
    addressRaw: '189 Kentucky Avenue, Lexington, KY 40505, US',
    addressComponents: {
      city: 'Lexington',
      state: 'KY',
      postal_code: '40505',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Stamping / welding / machining',
    industryKeywords: [
      'automotive',
      'stampings',
      'welded assemblies',
      'drivetrain components',
      'seating brackets'
    ]
  },
  {
    company: 'Star Manufacturing Inc.',
    parentCompany: null,
    website: 'https://starmanufacturinginc.com/',
    companyKey: 'starmanufacturinginc.com',
    companyId: 'cmp_72b0ce48a6d5',
    parentCompanyId: null,
    locationId: 'loc_72ff3d9b1120',
    addressRaw: '1000 Nandino Boulevard, Lexington, KY 40511, US',
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
    supplyChainSubtype: 'Metal stamping / welding / e-coat',
    industryKeywords: [
      'automotive',
      'stamping',
      'welding',
      'e-coat',
      'component solutions'
    ]
  },
  {
    company: 'Precision Molding, Inc.',
    parentCompany: null,
    website: 'https://www.precision-molding.com/location.php',
    companyKey: 'precision-molding.com',
    companyId: 'cmp_72e418c90af3',
    parentCompanyId: null,
    locationId: 'loc_72c07ab5df61',
    addressRaw: '5500 Roberts Matthews Hwy, Sparta, TN 38583, US',
    addressComponents: {
      city: 'Sparta',
      state: 'TN',
      postal_code: '38583',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Injection / insert / blow molding',
    industryKeywords: [
      'automotive',
      'injection molding',
      'insert molding',
      'blow molding',
      'assembly'
    ]
  },
  {
    company: 'Jones Plastic & Engineering',
    parentCompany: null,
    website: 'https://www.jonesplastic.com/',
    companyKey: 'jonesplastic.com',
    companyId: 'cmp_72d2a6f5be80',
    parentCompanyId: null,
    locationId: 'loc_72f3c18db245',
    addressRaw: '403 Commerce Drive, Williamsburg, KY 40769, US',
    addressComponents: {
      city: 'Williamsburg',
      state: 'KY',
      postal_code: '40769',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Injection molding / paint / hydrographics',
    industryKeywords: [
      'automotive',
      'injection molding',
      'paint',
      'hydrographics',
      'Kentucky corridor'
    ]
  },
  {
    company: 'Jones Plastic & Engineering',
    parentCompany: null,
    website: 'https://www.jonesplastic.com/',
    companyKey: 'jonesplastic.com',
    companyId: 'cmp_72d2a6f5be80',
    parentCompanyId: null,
    locationId: 'loc_72a6ef309b77',
    addressRaw: '1000 Manufacturing Drive, Camden, TN 38320, US',
    addressComponents: {
      city: 'Camden',
      state: 'TN',
      postal_code: '38320',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Injection molding / paint / hydrographics',
    industryKeywords: [
      'automotive',
      'injection molding',
      'paint',
      'hydrographics',
      'Tennessee corridor'
    ]
  },
  {
    company: 'Southeast Molding Inc.',
    parentCompany: null,
    website: 'https://southeastmolding.com/',
    companyKey: 'southeastmolding.com',
    companyId: 'cmp_7283f91d4be2',
    parentCompanyId: null,
    locationId: 'loc_72c28e7d5f92',
    addressRaw: '9088 Jetrail Drive, Ooltewah, TN 37363, US',
    addressComponents: {
      city: 'Ooltewah',
      state: 'TN',
      postal_code: '37363',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Injection molding',
    industryKeywords: [
      'automotive',
      'injection molding',
      'plastic parts',
      'Chattanooga corridor'
    ]
  },
  {
    company: 'SST - Service Stamping & Threading',
    parentCompany: null,
    website: 'https://sstmidpark.com/morgantown-sst/',
    companyKey: 'sstmidpark.com',
    companyId: 'cmp_72efb1d34c28',
    parentCompanyId: null,
    locationId: 'loc_72b10c6ae374',
    addressRaw: '490 Veterans Way, Morgantown, KY 42261, US',
    addressComponents: {
      city: 'Morgantown',
      state: 'KY',
      postal_code: '42261',
      country: 'US'
    },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'OEM metal stampings / subassemblies / tool and die',
    industryKeywords: [
      'automotive',
      'OEM stampings',
      'subassemblies',
      'tool and die',
      'Kentucky corridor'
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
      'No parentCompanyDbId links resolved. If Highlands should link to Bear Diversified, ensure a company with matching externalId or companyKey+name exists.'
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
