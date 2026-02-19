/**
 * Crawl official site: same-domain BFS from homepage + keyword paths.
 * Extract addresses (JSON-LD Organization/LocalBusiness first, then parse contact/locations pages).
 */

import * as cheerio from "cheerio";
import {
  CRAWL_KEYWORDS,
  MAX_CRAWL_DEPTH,
  MAX_CRAWL_PAGES,
  CRAWL_DELAY_MS,
  sameOrigin,
} from "./config.js";
import type { ExtractedAddress } from "./types.js";

const USER_AGENT = "daysweeper-crm-enrich/1.0 (address extraction)";

export interface CrawlResult {
  addresses: ExtractedAddress[];
  subsidiaryLinks: { name: string; url: string }[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function crawlOfficialSite(
  baseUrl: string,
  options?: { maxPages?: number; maxDepth?: number }
): Promise<CrawlResult> {
  const maxPages = options?.maxPages ?? MAX_CRAWL_PAGES;
  const maxDepth = options?.maxDepth ?? MAX_CRAWL_DEPTH;
  const addresses: ExtractedAddress[] = [];
  const subsidiaryLinks: { name: string; url: string }[] = [];
  const seen = new Set<string>();
  const normalize = (u: string) => {
    try {
      const x = new URL(u, baseUrl);
      x.hash = "";
      x.search = "";
      return x.href;
    } catch {
      return u;
    }
  };

  const queue: { url: string; depth: number }[] = [];
  const add = (url: string, depth: number) => {
    const n = normalize(url);
    if (!sameOrigin(baseUrl, n) || seen.has(n) || depth > maxDepth || seen.size >= maxPages) return;
    seen.add(n);
    queue.push({ url: n, depth });
  };
  add(baseUrl, 0);

  while (queue.length > 0 && seen.size <= maxPages) {
    const { url, depth } = queue.shift()!;
    await sleep(CRAWL_DELAY_MS);
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "follow" });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);

      const pageAddresses = extractAddressesFromPage($, html, url);
      for (const a of pageAddresses) {
        if (a.raw && a.raw.length > 5) addresses.push(a);
      }

      if (depth < maxDepth) {
        const links = $('a[href]').get();
        for (const el of links) {
          const href = $(el).attr("href");
          const text = $(el).text().trim().toLowerCase();
          if (!href) continue;
          const full = new URL(href, url).href;
          if (!sameOrigin(baseUrl, full)) continue;
          const path = new URL(full).pathname.toLowerCase();
          const keywordMatch = CRAWL_KEYWORDS.some((k) => path.includes(k) || text.includes(k));
          if (keywordMatch || depth === 0) add(full, depth + 1);
        }
      }
    } catch {
      // skip failed page
    }
  }

  return { addresses: dedupeAddresses(addresses), subsidiaryLinks };
}

function extractAddressesFromPage(
  $: cheerio.CheerioAPI,
  html: string,
  sourceUrl: string
): ExtractedAddress[] {
  const out: ExtractedAddress[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;
    try {
      let data: unknown = JSON.parse(raw);
      if (Array.isArray(data)) data = data[0];
      const obj = data as Record<string, unknown>;
      const type = [obj["@type"]].flat().filter(Boolean).join(" ").toLowerCase();
      if (!type.includes("organization") && !type.includes("localbusiness") && !type.includes("place")) return;
      const addr = obj.address as Record<string, unknown> | undefined;
      if (addr && typeof addr === "object") {
        const a = parseStructuredAddress(addr, sourceUrl);
        if (a) out.push(a);
      }
      const items = (obj["@graph"] as unknown[]) ?? [];
      for (const item of Array.isArray(items) ? items : []) {
        const i = item as Record<string, unknown>;
        const t = [i["@type"]].flat().filter(Boolean).join(" ").toLowerCase();
        if (!t.includes("organization") && !t.includes("localbusiness")) continue;
        const ad = i.address as Record<string, unknown> | undefined;
        if (ad && typeof ad === "object") {
          const a = parseStructuredAddress(ad, sourceUrl);
          if (a) out.push(a);
        }
      }
    } catch {
      // ignore invalid JSON-LD
    }
  });

  const text = $("body").text();
  const regexAddresses = extractAddressesFromText(text, sourceUrl);
  out.push(...regexAddresses);

  return out;
}

function parseStructuredAddress(
  addr: Record<string, unknown>,
  sourceUrl: string
): ExtractedAddress | null {
  const street =
    (addr.streetAddress as string) ??
    (addr.street as string) ??
    (Array.isArray(addr.streetAddress) ? (addr.streetAddress as string[]).join(", ") : undefined);
  const city = (addr.addressLocality as string) ?? (addr.city as string);
  const state = (addr.addressRegion as string) ?? (addr.state as string);
  const postalCode = (addr.postalCode as string) ?? (addr.postal_code as string);
  const country = (addr.addressCountry as string) ?? (addr.country as string);
  const c = typeof country === "object" && country && "name" in (country as object) ? (country as { name: string }).name : country;
  const parts = [street, city, state, postalCode, c].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  const raw = parts.join(", ");
  return {
    street: street ?? undefined,
    city: city ?? undefined,
    state: state ?? undefined,
    postalCode: postalCode ?? undefined,
    country: c ?? undefined,
    raw,
    sourceUrl,
  };
}

const US_STATE_ABBREV =
  /(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/;
const ZIP = /\b\d{5}(?:-\d{4})?\b/;

function extractAddressesFromText(bodyText: string, sourceUrl: string): ExtractedAddress[] {
  const out: ExtractedAddress[] = [];
  const lines = bodyText.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 15 || line.length > 200) continue;
    const hasState = US_STATE_ABBREV.test(line);
    const hasZip = ZIP.test(line);
    if (hasState && hasZip) {
      const raw = line.replace(/\s+/g, " ").trim();
      const zipMatch = raw.match(ZIP);
      const stateMatch = raw.match(US_STATE_ABBREV);
      if (zipMatch && stateMatch) {
        out.push({
          raw,
          sourceUrl,
          city: undefined,
          state: stateMatch[0],
          postalCode: zipMatch[0],
          country: raw.includes("US") || raw.includes("USA") ? "US" : undefined,
        });
      }
    }
  }
  return out;
}

function dedupeAddresses(list: ExtractedAddress[]): ExtractedAddress[] {
  const seen = new Set<string>();
  return list.filter((a) => {
    const k = a.raw.replace(/\s+/g, " ").trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
