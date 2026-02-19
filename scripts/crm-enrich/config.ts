/**
 * Directory domains to reject when resolving "official website".
 * Company site must not be one of these.
 */
export const DIRECTORY_DOMAINS = new Set([
  "linkedin.com",
  "wikipedia.org",
  "zoominfo.com",
  "dnb.com",
  "dunandbradstreet.com",
  "chamberofcommerce.com",
  "chambers.com",
  "bloomberg.com",
  "reuters.com",
  "thomasnet.com",
  "indeed.com",
  "glassdoor.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "youtube.com",
  "crunchbase.com",
  "pitchbook.com",
  "craft.co",
  "owler.com",
  "manta.com",
  "yellowpages.com",
  "bbb.org",
  "yelp.com",
  "mapquest.com",
  "loopnet.com",
  "reference.com",
  "answers.com",
  "waze.com",
  "hotfrog.com",
  "bizjournals.com",
  "sec.gov",
  "sedar.com",
  "gov",
  "wikipedia.org",
]);

/** Crawl keywords for finding locations/contact/facilities pages (path or link text). */
export const CRAWL_KEYWORDS = [
  "locations",
  "contact",
  "facilities",
  "plants",
  "offices",
  "where-we-are",
  "global-locations",
  "our-companies",
  "brands",
  "subsidiaries",
  "portfolio",
];

export const MAX_CRAWL_DEPTH = 3;
export const MAX_CRAWL_PAGES = 200;
export const CRAWL_DELAY_MS = 800;

export function isDirectoryDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return DIRECTORY_DOMAINS.has(host) || host.endsWith(".gov") || host.endsWith(".wikipedia.org");
  } catch {
    return true;
  }
}

export function sameOrigin(baseUrl: string, href: string): boolean {
  try {
    const b = new URL(baseUrl);
    const h = new URL(href, baseUrl);
    return b.origin === h.origin;
  } catch {
    return false;
  }
}
