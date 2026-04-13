/**
 * CRM import: Gestamp / Brose / DENSO / Toyoda Gosei US sites (batch).
 *
 *   npx tsx scripts/import-crm-corridor-gestamp-brose-denso-tg.ts
 */

import { config } from 'dotenv';
import type { PrismaClient } from '@prisma/client';
import { runCrmSupplierImport, type CrmSupplierJson } from '../src/lib/crm-supplier-import';

config({ path: '.env.vercel' });
config({ path: '.env.local' });
config({ path: '.env' });

const ROWS: CrmSupplierJson[] = [
  {
    company: 'Gestamp South Carolina',
    parentCompany: 'Gestamp',
    website:
      'https://www.gestamp.com/About-Us/Gestamp-in-the-world/Centers/America/USA/Gestamp-South-Carolina',
    companyKey: 'gestamp.com',
    companyId: 'cmp_72b1f8476a13',
    parentCompanyId: 'cmp_72p7c41e5d92',
    locationId: 'loc_72e61f03ac44',
    addressRaw: '1 LSP Road, Union, SC 29379, US',
    addressComponents: { city: 'Union', state: 'SC', postal_code: '29379', country: 'US' },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Stamped automotive body components',
    industryKeywords: ['automotive', 'stamping', 'body components', 'BMW Spartanburg corridor']
  },
  {
    company: 'Gestamp Chattanooga I',
    parentCompany: 'Gestamp',
    website:
      'https://www.gestamp.com/About-Us/Gestamp-in-the-world/Centers/America/USA/Gestamp-Chattanooga-I',
    companyKey: 'gestamp.com',
    companyId: 'cmp_72b1f8476a13',
    parentCompanyId: 'cmp_72p7c41e5d92',
    locationId: 'loc_72c9db8176e5',
    addressRaw: '3063 Hickory Valley Road, Chattanooga, TN 37421, US',
    addressComponents: { city: 'Chattanooga', state: 'TN', postal_code: '37421', country: 'US' },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Stamped / welded automotive structures',
    industryKeywords: ['automotive', 'stamping', 'welding', 'Chattanooga corridor']
  },
  {
    company: 'Gestamp Chattanooga II',
    parentCompany: 'Gestamp',
    website:
      'https://www.gestamp.com/About-Us/Gestamp-in-the-world/Centers/America/USA/Gestamp-Chattanooga-II',
    companyKey: 'gestamp.com',
    companyId: 'cmp_72b1f8476a13',
    parentCompanyId: 'cmp_72p7c41e5d92',
    locationId: 'loc_72c4ee2ab570',
    addressRaw: '7529 Ferdinand Piech Way, Chattanooga, TN 37416, US',
    addressComponents: { city: 'Chattanooga', state: 'TN', postal_code: '37416', country: 'US' },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Stamped / welded automotive structures',
    industryKeywords: ['automotive', 'stamping', 'welding', 'Volkswagen Chattanooga ecosystem']
  },
  {
    company: 'Brose Spartanburg, Inc.',
    parentCompany: 'Brose',
    website: 'https://www.brose.com/us-en/careers/job-production-assembly-operator-8458.html',
    companyKey: 'brose.com',
    companyId: 'cmp_726d2a91fc38',
    parentCompanyId: 'cmp_72p18db5c2f0',
    locationId: 'loc_72ab971cc54e',
    addressRaw: '1171 Howell Rd Suite 300, Duncan, SC 29334, US',
    addressComponents: { city: 'Duncan', state: 'SC', postal_code: '29334', country: 'US' },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Seat / door mechatronic components',
    industryKeywords: [
      'automotive',
      'mechatronics',
      'seat systems',
      'door systems',
      'Spartanburg corridor'
    ]
  },
  {
    company: 'DENSO Manufacturing Athens Tennessee, Inc.',
    parentCompany: 'DENSO',
    website: 'https://www.denso.com/us-ca/en/about-us/company-information/US/dmat/',
    companyKey: 'denso.com',
    companyId: 'cmp_72f4d3b65a20',
    parentCompanyId: 'cmp_72p4f0d7cb91',
    locationId: 'loc_72f81e3c9a67',
    addressRaw: '2400 Denso Drive, Athens, TN 37303, US',
    addressComponents: { city: 'Athens', state: 'TN', postal_code: '37303', country: 'US' },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Electronics_and_Mechatronics',
    supplyChainSubtype: 'Fuel / ignition / exhaust-related components',
    industryKeywords: [
      'automotive',
      'fuel systems',
      'ignition',
      'exhaust system components',
      'Athens TN'
    ]
  },
  {
    company: 'DENSO Manufacturing Tennessee, Inc.',
    parentCompany: 'DENSO',
    website: 'https://www.denso.com/us-ca/en/about-us/company-information/us/dmtn',
    companyKey: 'denso.com',
    companyId: 'cmp_72f4d3b65a20',
    parentCompanyId: 'cmp_72p4f0d7cb91',
    locationId: 'loc_72d0f1b86d2e',
    addressRaw: '1720 Robert C Jackson Drive, Maryville, TN 37801, US',
    addressComponents: { city: 'Maryville', state: 'TN', postal_code: '37801', country: 'US' },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Electronics_and_Mechatronics',
    supplyChainSubtype: 'Automotive electronics / electrification components',
    industryKeywords: [
      'automotive',
      'electronics',
      'instrument clusters',
      'inverters',
      'electrification',
      'Maryville TN'
    ]
  },
  {
    company: 'TG Kentucky, LLC',
    parentCompany: 'Toyoda Gosei Co., Ltd.',
    website: 'https://www.toyoda-gosei.com/kigyou/kyoten/usa/',
    companyKey: 'toyoda-gosei.com',
    companyId: 'cmp_721a4e37bd5f',
    parentCompanyId: 'cmp_72p66cd14b29',
    locationId: 'loc_72ae6c91f7d4',
    addressRaw: '633 E. Main Street, Lebanon, KY 40033, US',
    addressComponents: { city: 'Lebanon', state: 'KY', postal_code: '40033', country: 'US' },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Interior / exterior plastic and functional components',
    industryKeywords: [
      'automotive',
      'interior parts',
      'exterior parts',
      'functional components',
      'Kentucky corridor'
    ]
  },
  {
    company: 'TG Automotive Sealing Kentucky, LLC',
    parentCompany: 'Toyoda Gosei Co., Ltd.',
    website: 'https://www.toyoda-gosei.com/kigyou/kyoten/usa/',
    companyKey: 'toyoda-gosei.com',
    companyId: 'cmp_721a4e37bd5f',
    parentCompanyId: 'cmp_72p66cd14b29',
    locationId: 'loc_72c65a204db9',
    addressRaw: '501 Frank Yost Lane, Hopkinsville, KY 42240, US',
    addressComponents: { city: 'Hopkinsville', state: 'KY', postal_code: '42240', country: 'US' },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Weatherstrips / sealing components',
    industryKeywords: [
      'automotive',
      'weatherstrips',
      'sealing',
      'rubber components',
      'Kentucky corridor'
    ]
  },
  {
    company: 'TG Missouri Corporation',
    parentCompany: 'Toyoda Gosei Co., Ltd.',
    website: 'https://www.toyoda-gosei.com/kigyou/kyoten/usa/',
    companyKey: 'toyoda-gosei.com',
    companyId: 'cmp_721a4e37bd5f',
    parentCompanyId: 'cmp_72p66cd14b29',
    locationId: 'loc_7298da37fb04',
    addressRaw: '2200 Plattin Road, Perryville, MO 63775, US',
    addressComponents: { city: 'Perryville', state: 'MO', postal_code: '63775', country: 'US' },
    tier: 'Tier 2',
    segment: 'USA',
    supplyChainCategory: 'Tier_2',
    supplyChainSubtypeGroup: 'Manufacturing',
    supplyChainSubtype: 'Safety / interior / exterior automotive parts',
    industryKeywords: [
      'automotive',
      'safety system products',
      'interior parts',
      'exterior parts',
      'Missouri corridor'
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
