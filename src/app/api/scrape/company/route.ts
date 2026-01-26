import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as cheerio from "cheerio";

type Draft = {
  company?: string;
  website?: string;
  domain?: string;
  email?: string;
  phone?: string;
  addressRaw?: string;
  logoUrl?: string;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

function sanitizeUrl(input: string) {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    return new URL(u);
  } catch {
    return null;
  }
}

function baseDomain(u: URL) {
  const host = u.hostname.toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
}

function titleToName(title?: string, domain?: string) {
  if (!title && domain) return domain.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, m => m.toUpperCase());
  if (!title) return undefined;
  const cleaned = title.replace(/\s*\|.*$|\s*[-–—].*$/g, ""); // strip suffixes like " | Home"
  return cleaned.trim();
}

function first<T>(...vals: (T | undefined | null | "")[]) {
  for (const v of vals) if (v && String(v).trim()) return v as T;
}

function extractPhones($: cheerio.CheerioAPI) {
  const phones = new Set<string>();
  $('a[href^="tel:"]').each((_, el) => {
    const raw = ($(el).attr("href") || "").replace(/^tel:/, "");
    phones.add(normalizePhone(raw));
  });
  const text = $("body").text();
  const rx = /(\+?\d[\d\-\.\s\(\)]{6,}\d)/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text))) phones.add(normalizePhone(m[1]));
  return Array.from(phones).filter(Boolean);
}

function normalizePhone(p?: string) {
  if (!p) return "";
  const digits = p.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits; // US
  if (digits.length === 10) return "+1" + digits;
  return "+" + digits;
}

function extractEmails($: cheerio.CheerioAPI) {
  const emails = new Set<string>();
  $('a[href^="mailto:"]').each((_, el) => {
    const raw = ($(el).attr("href") || "").replace(/^mailto:/, "");
    const addr = raw.split("?")[0].trim();
    if (addr) emails.add(addr.toLowerCase());
  });
  const text = $("body").text();
  const rx = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text))) emails.add(m[0].toLowerCase());
  return Array.from(emails);
}

function extractAddress($: cheerio.CheerioAPI) {
  // MVP heuristic: prefer <address>, else footer text chunk
  const addr = $("address").first().text().trim();
  if (addr) return addr.replace(/\s+/g, " ");
  const footer = $("footer").text().trim().replace(/\s+/g, " ");
  // crude US pattern
  const rx = /\d{1,6}\s+[A-Za-z0-9\.\- ]+,\s*[A-Za-z\.\- ]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/;
  const m = footer.match(rx);
  return m ? m[0] : undefined;
}

async function fetchHTML(u: URL) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 10000);
  try {
    const res = await fetch(u.toString(), {
      headers: { "user-agent": UA, accept: "text/html,*/*" },
      signal: ac.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return text;
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    const u = sanitizeUrl(url);
    if (!u) return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    const domain = baseDomain(u);

    const html = await fetchHTML(u);
    const $ = cheerio.load(html);

    const metaTitle = $('meta[property="og:title"]').attr("content") || $("title").first().text();
    const metaDesc =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      undefined;

    const logoUrl =
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      $('meta[property="og:image"]').attr("content") ||
      undefined;

    const emails = extractEmails($);
    const phones = extractPhones($);
    const addressRaw = extractAddress($);

    const draft: Draft = {
      company: titleToName(metaTitle, domain),
      website: u.toString(),
      domain,
      email: emails[0],
      phone: phones[0],
      addressRaw,
      logoUrl,
    };

    // Dedupe candidates: website domain, partial company, last 7 digits of phone
    const nameToken = (draft.company || domain).toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 3)[0] || "";
    const last7 = (draft.phone || "").replace(/\D/g, "").slice(-7);
    const candidates = await prisma.target.findMany({
      where: {
        OR: [
          { website: { contains: domain, mode: "insensitive" } },
          { company: nameToken ? { contains: nameToken, mode: "insensitive" } : undefined },
          last7 ? { phone: { contains: last7 } } : undefined,
        ].filter(Boolean) as any,
      },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: { id: true, company: true, website: true, phone: true, email: true, addressRaw: true, createdAt: true },
    });

    // Store a scrape record for audit
    await prisma.scrapedCompany.upsert({
      where: { url: u.toString() },
      update: {
        companyName: draft.company,
        address: draft.addressRaw,
        phone: draft.phone,
        email: draft.email,
        domain,
        scrapedData: { metaTitle, metaDesc, emails, phones, logoUrl },
      },
      create: {
        url: u.toString(),
        companyName: draft.company,
        address: draft.addressRaw,
        phone: draft.phone,
        email: draft.email,
        domain,
        scrapedData: { metaTitle, metaDesc, emails, phones, logoUrl },
      },
    });

    return NextResponse.json({ profileDraft: draft, candidates });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Scrape failed" }, { status: 500 });
  }
}
