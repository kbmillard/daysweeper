/**
 * Types for auction source scrapers
 */

export type AuctionPlatform = 'bidspotter' | 'proxibid';

export type RawLot = {
  platform: AuctionPlatform;
  lotUrl: string;
  auctionUrl?: string;
  lotNumber?: string;
  title: string;
  quantity?: number;
  quantityRaw?: string;
  auctionTitle?: string;
  locationLine?: string;
  city?: string;
  state?: string;
  saleStart?: Date;
  saleEnd?: Date;
  auctioneerName?: string;
  auctioneerPhone?: string;
  auctioneerEmail?: string;
  auctioneerWebsite?: string;
  contactName?: string;
  contactDetail?: string;
  descriptionExcerpt?: string;
  thumbnailUrl?: string;
  matchedTerm: string;
};

export type ScrapeResult = {
  lots: RawLot[];
  errors: string[];
  searchTerm: string;
  platform: AuctionPlatform;
};

/**
 * Generate a stable key for deduplication
 * Format: platform:lotId (extracted from URL)
 */
export function generateStableKey(lot: RawLot): string {
  const { platform, lotUrl } = lot;

  if (platform === 'proxibid') {
    // Extract lot ID from Proxibid URL
    // e.g., /lotInformation/100118958 -> proxibid:100118958
    const match = lotUrl.match(/lotInformation\/(\d+)/i);
    if (match) {
      return `proxibid:${match[1]}`;
    }
    // Fallback: use URL hash
    const urlHash = Buffer.from(lotUrl).toString('base64').slice(0, 20);
    return `proxibid:url:${urlHash}`;
  }

  if (platform === 'bidspotter') {
    // Extract lot ID from BidSpotter URL
    // e.g., /lot-abc123-def456 or /lot/abc123
    const match = lotUrl.match(/lot[/-]([a-f0-9-]+)/i);
    if (match) {
      return `bidspotter:${match[1]}`;
    }
    const urlHash = Buffer.from(lotUrl).toString('base64').slice(0, 20);
    return `bidspotter:url:${urlHash}`;
  }

  return `${platform}:${Buffer.from(lotUrl).toString('base64').slice(0, 20)}`;
}
