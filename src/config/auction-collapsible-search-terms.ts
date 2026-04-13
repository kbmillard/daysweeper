/**
 * Keywords for auction lot scope (collapsible containers / bulk packaging signals).
 * Used by auction source normalizers.
 */

export const IN_SCOPE_KEYWORDS = [
  'gaylord',
  'bulk',
  'container',
  'tot',
  'ibc',
  'drum',
  'pallet',
  'roll',
  'collapsible',
  'bin',
  'tote'
];

export const OUT_OF_SCOPE_KEYWORDS = [
  'real estate',
  'realty',
  'residential',
  'house',
  'condo',
  'vehicle only',
  'automobile only',
  'office furniture'
];

/** Primary search phrase passed into scrapers (sitemap / search entry point). */
export const AUCTION_SEARCH_TERMS = ['gaylord bulk container', 'ibc tote', 'collapsible bulk bin'];

/** Platforms recorded on poll runs. */
export const AUCTION_PLATFORMS = ['proxibid', 'bidspotter'];
