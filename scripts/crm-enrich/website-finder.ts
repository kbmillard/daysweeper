/**
 * Find official website: SerpAPI search "{company name} official website",
 * reject directory domains, verify by fetching homepage and checking company name in header/footer.
 */

import { isDirectoryDomain } from "./config.js";

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const USER_AGENT = "daysweeper-crm-enrich/1.0 (official website verification)";

export async function searchOfficialWebsite(companyName: string): Promise<string | null> {
  if (!SERPAPI_KEY) {
    console.warn("SERPAPI_KEY not set; skipping website search");
    return null;
  }
  const q = encodeURIComponent(`${companyName} official website`);
  const url = `https://serpapi.com/search.json?q=${q}&api_key=${SERPAPI_KEY}&num=10`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const data = (await res.json()) as { organic_results?: { link: string; title?: string }[] };
  const results = data.organic_results ?? [];
  for (const r of results) {
    const link = r?.link;
    if (!link || typeof link !== "string") continue;
    if (isDirectoryDomain(link)) continue;
    const verified = await verifyOfficialSite(link, companyName);
    if (verified) return normalizeWebsiteUrl(link);
  }
  return null;
}

function normalizeWebsiteUrl(url: string): string {
  try {
    const u = new URL(url);
    u.pathname = u.pathname === "/" ? "/" : u.pathname.replace(/\/+$/, "") || "/";
    u.search = "";
    u.hash = "";
    return `${u.origin}${u.pathname}`.replace(/\/$/, "") || u.origin + "/";
  } catch {
    return url;
  }
}

/**
 * Fetch homepage and check that company name (or normalized tokens) appears in header/footer.
 * Uses first ~500 chars and last ~2000 chars of text content to approximate header/footer.
 */
export async function verifyOfficialSite(url: string, companyName: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (!res.ok) return false;
    const html = await res.text();
    const text = stripHtmlToText(html);
    const tokens = normalizeCompanyNameForMatch(companyName);
    if (tokens.length === 0) return false;
    const head = text.slice(0, 800);
    const tail = text.slice(-2500);
    const combined = (head + " " + tail).toLowerCase();
    const matchCount = tokens.filter((t) => combined.includes(t.toLowerCase())).length;
    return matchCount >= Math.min(2, tokens.length) || tokens.some((t) => combined.includes(t.toLowerCase()));
  } catch {
    return false;
  }
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompanyNameForMatch(name: string): string[] {
  const cleaned = name
    .replace(/[,;.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter((w) => w.length > 1 && !/^(inc|llc|ltd|corp|co|the|and|&)$/i.test(w));
  const tokens: string[] = [cleaned];
  if (words.length > 1) tokens.push(...words.filter((w) => w.length > 2));
  return [...new Set(tokens)];
}
