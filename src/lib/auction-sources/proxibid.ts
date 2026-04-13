/**
 * Proxibid Scraper
 *
 * Proxibid search pages are noisy and highly JS-dependent. The reliable source
 * for current lots is the public lot sitemap index, which gives us direct lot
 * URLs without guessing at hidden APIs or DOM selectors.
 */

import * as cheerio from 'cheerio';
import type { RawLot, ScrapeResult } from './types';
import { cleanText, parseQuantity } from './normalize';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PROXIBID_BASE = 'https://www.proxibid.com';
const SITEMAP_INDEX_URL = `${PROXIBID_BASE}/sitemap-lots.xml`;
const MAX_CANDIDATE_URLS = 80;
const DETAIL_BATCH_SIZE = 6;

let proxibidDiscoveryPromise: Promise<{ lots: RawLot[]; errors: string[] }> | null =
  null;

export async function searchProxibid(term: string): Promise<ScrapeResult> {
  if (!proxibidDiscoveryPromise) {
    proxibidDiscoveryPromise = discoverRelevantProxibidLots();
  }

  const { lots, errors } = await proxibidDiscoveryPromise;

  return {
    lots: lots.map((lot) => ({ ...lot, matchedTerm: term })),
    errors,
    searchTerm: term,
    platform: 'proxibid'
  };
}

async function discoverRelevantProxibidLots(): Promise<{
  lots: RawLot[];
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    const sitemapUrls = await fetchSitemapUrls();
    const candidateUrls = await collectCandidateLotUrls(sitemapUrls);

    if (candidateUrls.length === 0) {
      errors.push('Proxibid sitemap discovery found 0 candidate lot URLs.');
      return { lots: [], errors };
    }

    const lots = await fetchLotsFromCandidateUrls(candidateUrls, errors);

    if (lots.length === 0) {
      errors.push(
        `Proxibid parsed ${candidateUrls.length} candidate URLs but found 0 in-scope lots.`
      );
    }

    return {
      lots: deduplicateLots(lots),
      errors
    };
  } catch (error) {
    errors.push(
      `Proxibid sitemap discovery failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
    return { lots: [], errors };
  }
}

async function fetchSitemapUrls(): Promise<string[]> {
  const xml = await fetchText(SITEMAP_INDEX_URL, 15000);
  const matches = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi));
  return matches.map((match) => match[1]).filter(Boolean);
}

async function collectCandidateLotUrls(sitemapUrls: string[]): Promise<string[]> {
  const urls = new Set<string>();

  for (const sitemapUrl of sitemapUrls) {
    const xml = await fetchText(sitemapUrl, 15000);
    const matches = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi));

    for (const match of matches) {
      const lotUrl = match[1];
      if (!lotUrl) continue;
      if (!isLikelyTargetUrl(lotUrl)) continue;

      urls.add(lotUrl);
      if (urls.size >= MAX_CANDIDATE_URLS) {
        return Array.from(urls);
      }
    }
  }

  return Array.from(urls);
}

async function fetchLotsFromCandidateUrls(
  candidateUrls: string[],
  errors: string[]
): Promise<RawLot[]> {
  const lots: RawLot[] = [];

  for (let i = 0; i < candidateUrls.length; i += DETAIL_BATCH_SIZE) {
    const batch = candidateUrls.slice(i, i + DETAIL_BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (lotUrl) => parseProxibidLotPage(lotUrl))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value) {
          lots.push(result.value);
        }
      } else {
        errors.push(
          `Proxibid lot page parse failed: ${
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
          }`
        );
      }
    }
  }

  return lots;
}

async function parseProxibidLotPage(lotUrl: string): Promise<RawLot | null> {
  const html = await fetchText(lotUrl, 15000);
  const $ = cheerio.load(html);

  const title =
    cleanText($('h1.lotHeaderDescription').first().text()) ||
    cleanText($('h1').first().text()) ||
    cleanText($('meta[name="description"]').attr('content')) ||
    cleanText($('title').text().split('|')[0]);

  if (!title) return null;

  const contentText = cleanText($('#lot-detail-content-container').text());
  const sellerName =
    cleanText($('#SellerName').attr('value')) ||
    cleanText($('.auction-house, .seller, .auctioneer').first().text());
  const auctionTitle = cleanText(
    $('a[href*="/asp/catalog.asp?aid="]').first().text()
  );
  const lotNumberMatch = contentText.match(/Lot\s*#\s*([A-Za-z0-9-]+)/i);
  const location = parseLocationFromUrl(lotUrl);
  const detailSnippet = extractDetailSnippet(contentText, title);
  const thumbnailUrl =
    $('#image-wrapper img').first().attr('src') ||
    $('#image-wrapper img').first().attr('data-src') ||
    undefined;

  const descriptionExcerpt = cleanText(
    extractDescriptionExcerpt(
      $('meta[name="description"]').attr('content'),
      detailSnippet
    )
  ).slice(0, 400);

  if (!isLikelyTargetLot(title, descriptionExcerpt)) {
    return null;
  }

  return {
    platform: 'proxibid',
    lotUrl,
    lotNumber: lotNumberMatch?.[1],
    title,
    quantity: extractLikelyLotQuantity(title, detailSnippet),
    quantityRaw: detailSnippet || undefined,
    auctionTitle: auctionTitle || undefined,
    ...location,
    auctioneerName: sellerName || undefined,
    descriptionExcerpt: descriptionExcerpt || undefined,
    thumbnailUrl,
    matchedTerm: 'catalog-discovery'
  };
}

function parseLocationFromUrl(lotUrl: string): {
  city?: string;
  state?: string;
  locationLine?: string;
} {
  try {
    const url = new URL(lotUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    const slug = segments.at(-2);

    if (!slug) return {};

    const match = slug.match(/^([A-Za-z-]+(?:-[A-Za-z-]+)*)-([A-Z]{2})-/);
    if (!match) return {};

    const city = match[1].replace(/-/g, ' ').trim();
    const state = match[2];

    return {
      city,
      state,
      locationLine: `${city}, ${state}`
    };
  } catch {
    return {};
  }
}

function extractDetailSnippet(contentText: string, title: string): string {
  const idx = contentText.indexOf(title);
  if (idx >= 0) {
    return cleanText(contentText.slice(idx, idx + 600));
  }
  return cleanText(contentText.slice(0, 600));
}

function extractDescriptionExcerpt(
  metaDescription: string | undefined,
  detailSnippet: string
): string {
  const meta = cleanText(metaDescription);
  if (meta && meta.toLowerCase() !== detailSnippet.toLowerCase()) {
    return meta;
  }

  return detailSnippet;
}

function extractLikelyLotQuantity(
  title: string,
  detailSnippet: string
): number | undefined {
  const multiplierMatch = detailSnippet.match(
    /\$\s*\d[\d,.]*(?:\.\d+)?\s*x\s*(\d{1,4})\b/i
  );

  if (multiplierMatch?.[1]) {
    const parsed = parseInt(multiplierMatch[1], 10);
    if (parsed > 0 && parsed < 10000) {
      return parsed;
    }
  }

  return parseQuantity(title) ?? parseQuantity(detailSnippet);
}

function isLikelyTargetUrl(lotUrl: string): boolean {
  const lower = lotUrl.toLowerCase();

  const includePatterns = [
    /gaylord/,
    /bulk-bin/,
    /bulk-bins/,
    /bulk-container/,
    /pallet-container/,
    /plastic-pallet-container/,
    /pallet-box/,
    /collaps[^/]*(crate|container|box|bin|pallet)/,
    /folding-pallet-box/,
    /(ifco|tosca|monoflo|schoeller)/,
    /(orbis|buckhorn|uline)[^/]*(container|crate|box|bin|pallet|gaylord)/
  ];

  const excludePatterns = [
    /shipping-container/,
    /container-trailer/,
    /roll-off/,
    /trailer/,
    /truck/,
    /generator/,
    /water-holding/,
    /crate-of/,
    /produce-crate-cart/,
    /display/,
    /table/,
    /ladder/,
    /chair/,
    /drone/,
    /blind/,
    /rifle/,
    /shotgun/,
    /knife/,
    /stock/,
    /foot-spa/,
    /drink-carriers?/,
    /dog-ramp/,
    /spyglass/,
    /mirror/,
    /picnic-table/,
    /irrigation-reel/,
    /cart/,
    /screen/,
    /map/,
    /print/,
    /real-estate/,
    /community/,
    /muzzleloader/,
    /security-cameras/,
    /hose/
  ];

  return (
    includePatterns.some((pattern) => pattern.test(lower)) &&
    !excludePatterns.some((pattern) => pattern.test(lower))
  );
}

function isLikelyTargetLot(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();

  const requiredSignals = [
    /\bgaylord\b/,
    /\bbulk container\b/,
    /\bpallet container\b/,
    /\bplastic pallet container\b/,
    /\bpallet boxes?\b/,
    /\bbulk bins?\b/,
    /\bcollaps(?:ible|able).{0,20}(crate|container|box|bin|pallet box|pallet boxes|pallet container)\b/,
    /\bfold(?:ing|able).{0,20}(pallet box|pallet boxes|container|crate|bin)\b/,
    /\b(ifco|tosca|monoflo|schoeller)\b/,
    /\b(orbis|buckhorn|uline).{0,20}(container|crate|box|bin|pallet|gaylord)\b/,
    /\b(container|crate|box|bin|pallet|gaylord).{0,20}(orbis|buckhorn|uline)\b/
  ];

  const outOfScopeSignals = [
    /\bshipping container\b/,
    /\bcontainer trailer\b/,
    /\broll[- ]?off\b/,
    /\bwater holding\b/,
    /\bgenerator\b/,
    /\bdisplay\b/,
    /\btable\b/,
    /\bchair\b/,
    /\bladder\b/,
    /\bdrone\b/,
    /\bblind\b/,
    /\bknife\b/,
    /\brifle\b/,
    /\bshotgun\b/,
    /\bfoot spa\b/,
    /\bdrink carrier\b/,
    /\bcollapsible cups?\b/,
    /\bhose\b/,
    /\bmirror\b/,
    /\bscreen\b/,
    /\bmap\b/,
    /\bprint\b/,
    /\breal estate\b/,
    /\bcommunity\b/,
    /\bmuzzleloader\b/,
    /\bsecurity cameras?\b/,
    /\bsteel pallet\b/
  ];

  return (
    requiredSignals.some((pattern) => pattern.test(text)) &&
    !outOfScopeSignals.some((pattern) => pattern.test(text))
  );
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }

  return response.text();
}

function deduplicateLots(lots: RawLot[]): RawLot[] {
  const seen = new Map<string, RawLot>();

  for (const lot of lots) {
    const key = lot.lotUrl;
    if (!seen.has(key)) {
      seen.set(key, lot);
      continue;
    }

    const existing = seen.get(key)!;
    if (!existing.quantity && lot.quantity) {
      existing.quantity = lot.quantity;
    }
    if (!existing.auctionTitle && lot.auctionTitle) {
      existing.auctionTitle = lot.auctionTitle;
    }
    if (!existing.auctioneerName && lot.auctioneerName) {
      existing.auctioneerName = lot.auctioneerName;
    }
    if (!existing.city && lot.city) {
      existing.city = lot.city;
      existing.state = lot.state;
      existing.locationLine = lot.locationLine;
    }
  }

  return Array.from(seen.values());
}
