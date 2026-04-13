/**
 * BidSpotter Scraper
 *
 * BidSpotter search pages currently do not return dependable in-scope container
 * results from server-side HTML, and the prior Browserless/guessed-API approach
 * still produced silent zero-result runs. Keep this explicit so the poller can
 * succeed from Proxibid while we add a real BidSpotter discovery source later.
 */

import type { ScrapeResult } from './types';

export async function searchBidSpotter(term: string): Promise<ScrapeResult> {
  return {
    lots: [],
    errors: [
      'BidSpotter discovery is temporarily disabled until a reliable lot-source is implemented.'
    ],
    searchTerm: term,
    platform: 'bidspotter'
  };
}
