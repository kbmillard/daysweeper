/**
 * Query enrichment statistics from Daysweeper database
 * Run: npx tsx scripts/query_enrichment_stats.ts
 */

import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Querying target enrichment statistics...\n');

  const targets = await prisma.target.findMany({
    select: {
      id: true,
      company: true,
      phone: true,
      website: true,
      email: true,
      addressRaw: true,
      addressNormalized: true,
      TargetEnrichment: {
        select: { enrichedJson: true }
      }
    }
  });

  const total = targets.length;

  const stats = {
    total,
    hasRealCompanyName: 0,
    hasPhone: 0,
    hasWebsite: 0,
    hasEmail: 0,
    hasBio: 0,
    hasFullAddress: 0,
    hasPartialAddress: 0,
    hasNoAddress: 0,
    hasPlacesContext: 0,
    hasPinResearch: 0,
    hasPinResearchCompanyName: 0
  };

  const genericNamePattern = /^(Prospect|Pin)\s+\d+$/i;

  for (const t of targets) {
    const enrichedJson = t.TargetEnrichment?.enrichedJson as Record<string, unknown> | null;

    // Company name (real vs placeholder)
    const pinResearch = enrichedJson?.pin_research as Record<string, unknown> | null;
    const pinResearchName = pinResearch?.company_name || pinResearch?.companyName;
    const placesContext = enrichedJson?.places_context as string | null;
    const snapshot = enrichedJson?.snapshot as Record<string, unknown> | null;
    const snapshotLegalName = snapshot?.legalName as string | null;

    const hasRealName =
      (!genericNamePattern.test(t.company)) ||
      (typeof pinResearchName === 'string' && pinResearchName.trim().length > 0) ||
      (typeof snapshotLegalName === 'string' && snapshotLegalName.trim().length > 0) ||
      (typeof placesContext === 'string' && placesContext.includes('Listed as:'));

    if (hasRealName) stats.hasRealCompanyName++;

    // Phone
    const pinPhone = pinResearch?.phone as string | null;
    const snapshotPhone = snapshot?.contactPhone as string | null;
    if (t.phone?.trim() || pinPhone?.trim() || snapshotPhone?.trim()) stats.hasPhone++;

    // Website
    const pinWebsite = pinResearch?.website as string | null;
    if (t.website?.trim() || pinWebsite?.trim()) stats.hasWebsite++;

    // Email
    const pinEmail = pinResearch?.email as string | null;
    if (t.email?.trim() || pinEmail?.trim()) stats.hasEmail++;

    // Bio/summary
    const pinSummary = pinResearch?.summary as string | null;
    const snapshotSummary = snapshot?.summary as string | null;
    if (pinSummary?.trim() || snapshotSummary?.trim() || (placesContext && placesContext.length > 50)) {
      stats.hasBio++;
    }

    // Address
    const pinAddress = pinResearch?.address as string | null;
    const fullAddress = t.addressNormalized?.trim() || pinAddress?.trim();
    const partialAddress = t.addressRaw?.trim();
    if (fullAddress && fullAddress.length > 10) {
      stats.hasFullAddress++;
    } else if (partialAddress && partialAddress.length > 5) {
      stats.hasPartialAddress++;
    } else {
      stats.hasNoAddress++;
    }

    // Places context
    if (placesContext?.trim()) stats.hasPlacesContext++;

    // Pin research
    if (pinResearch) stats.hasPinResearch++;
    if (pinResearchName && typeof pinResearchName === 'string' && pinResearchName.trim()) {
      stats.hasPinResearchCompanyName++;
    }
  }

  console.log('=== ENRICHMENT STATISTICS ===\n');
  console.log(`Total targets: ${stats.total}\n`);
  console.log(`1. Company Names (real, not "Prospect N"): ${stats.hasRealCompanyName} / ${stats.total}`);
  console.log(`   - From pin_research.company_name: ${stats.hasPinResearchCompanyName}`);
  console.log(`2. Phone Numbers: ${stats.hasPhone} / ${stats.total}`);
  console.log(`3. Websites: ${stats.hasWebsite} / ${stats.total}`);
  console.log(`4. Emails: ${stats.hasEmail} / ${stats.total}`);
  console.log(`5. Bio/Summary text: ${stats.hasBio} / ${stats.total}`);
  console.log(`6. Address Coverage:`);
  console.log(`   - Full address: ${stats.hasFullAddress} / ${stats.total}`);
  console.log(`   - Partial address: ${stats.hasPartialAddress} / ${stats.total}`);
  console.log(`   - No address: ${stats.hasNoAddress} / ${stats.total}`);
  console.log(`\nPlaces Context: ${stats.hasPlacesContext} / ${stats.total}`);
  console.log(`Pin Research records: ${stats.hasPinResearch} / ${stats.total}`);

  // Sample some with missing data
  console.log('\n=== SAMPLE OF MISSING DATA ===\n');
  const missingNames = targets
    .filter(t => {
      const enrichedJson = t.TargetEnrichment?.enrichedJson as Record<string, unknown> | null;
      const pinResearch = enrichedJson?.pin_research as Record<string, unknown> | null;
      const pinResearchName = pinResearch?.company_name || pinResearch?.companyName;
      return genericNamePattern.test(t.company) && !pinResearchName;
    })
    .slice(0, 5);

  console.log('Targets still showing "Prospect N" with no pin_research company_name:');
  for (const t of missingNames) {
    const enrichedJson = t.TargetEnrichment?.enrichedJson as Record<string, unknown> | null;
    console.log(`  - ${t.id}: "${t.company}" | places_context: ${enrichedJson?.places_context ? 'YES' : 'NO'}`);
  }
}

main()
  .catch(console.error)
  .finally(async () => await prisma.$disconnect());
