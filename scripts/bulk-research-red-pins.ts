#!/usr/bin/env tsx
import { config } from 'dotenv';
import { Prisma } from '@prisma/client';
import type { PinPlaceCandidate, PinPlaceResearchResult } from '../src/lib/pin-place-research';
import {
  shouldExcludeConsumerPoi,
  PIN_RESEARCH_LLM_INDUSTRIAL_BIAS
} from '../src/lib/pin-place-consumer-filter';

config({ path: '.env.production.local' });
config({ path: '.env.local' });
config({ path: '.env' });

let prisma: any;
/** Filled from @/lib/pin-place-research in main() after dotenv (reads PIN_RESEARCH_RADIUS_METERS). */
let DEFAULT_PIN_RESEARCH_RADIUS_METERS = 420;
let pinResearchDefaultCacheKey: any;
let writePinResearchCache: any;

type Args = {
  dryRun: boolean;
  limit: number;
  sleepMs: number;
  force: boolean;
};

type WebResearchProfile = {
  companyName: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  summary: string | null;
  confidence: string | null;
  sources: string[];
};

type NearbyCandidate = {
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
};

function parseArgs(argv: string[]): Args {
  const has = (flag: string) => argv.includes(flag);
  const valueAfter = (flag: string) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  return {
    dryRun: has('--dry-run'),
    limit: Number(valueAfter('--limit') ?? 0) || 0,
    sleepMs: Math.max(0, Number(valueAfter('--sleep-ms') ?? 350) || 350),
    force: has('--force')
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decimalCoord(n: number): Prisma.Decimal {
  const rounded = Math.round(n * 1e6) / 1e6;
  return new Prisma.Decimal(rounded.toFixed(6));
}

function genericProspectName(name: string | null | undefined): boolean {
  const s = (name ?? '').trim();
  return /^prospect(\s+\d+)?$/i.test(s) || /^pin$/i.test(s) || /^prospect pin$/i.test(s);
}

function googleKey(): string {
  return (
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    ''
  );
}

function openAIKey(): string {
  return process.env.OPENAI_API_KEY?.trim() || '';
}

async function reverseGeocode(lat: number, lng: number, key: string): Promise<string | null> {
  const u = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  u.searchParams.set('latlng', `${lat.toFixed(6)},${lng.toFixed(6)}`);
  u.searchParams.set('key', key);
  const res = await fetch(u.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status?: string;
    results?: Array<{ formatted_address?: string }>;
  };
  if (data.status !== 'OK') return null;
  return data.results?.[0]?.formatted_address?.trim() || null;
}

async function nearbyCandidates(lat: number, lng: number, key: string): Promise<NearbyCandidate[]> {
  const nearby = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  nearby.searchParams.set('location', `${lat.toFixed(6)},${lng.toFixed(6)}`);
  nearby.searchParams.set('radius', String(DEFAULT_PIN_RESEARCH_RADIUS_METERS));
  nearby.searchParams.set('key', key);

  const nearbyRes = await fetch(nearby.toString());
  if (!nearbyRes.ok) return [];
  const nearbyJson = (await nearbyRes.json()) as {
    status?: string;
    results?: Array<{ place_id?: string; name?: string; types?: string[] }>;
  };
  if (nearbyJson.status !== 'OK' && nearbyJson.status !== 'ZERO_RESULTS') return [];

  const prelim = (nearbyJson.results ?? []).filter(
    (r) =>
      r.place_id &&
      r.name &&
      !shouldExcludeConsumerPoi(r.types, r.name)
  );

  const placeIds = prelim
    .map((r) => r.place_id)
    .filter((v): v is string => Boolean(v))
    .slice(0, 12);

  const out: NearbyCandidate[] = [];
  for (const placeId of placeIds) {
    const detail = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    detail.searchParams.set('place_id', placeId);
    detail.searchParams.set(
      'fields',
      'name,formatted_address,formatted_phone_number,international_phone_number,website,types'
    );
    detail.searchParams.set('key', key);
    const res = await fetch(detail.toString());
    if (!res.ok) continue;
    const data = (await res.json()) as {
      status?: string;
      result?: {
        name?: string;
        formatted_address?: string;
        formatted_phone_number?: string;
        international_phone_number?: string;
        website?: string;
        types?: string[];
      };
    };
    if (data.status !== 'OK' || !data.result?.name) continue;
    if (shouldExcludeConsumerPoi(data.result.types, data.result.name)) continue;
    out.push({
      name: data.result.name,
      address: data.result.formatted_address ?? null,
      phone: data.result.formatted_phone_number ?? data.result.international_phone_number ?? null,
      website: data.result.website ?? null
    });
  }
  return out;
}

function extractResponseText(data: unknown): string {
  const d = data as Record<string, unknown>;
  if (typeof d.output_text === 'string' && d.output_text.trim()) return d.output_text.trim();
  const output = Array.isArray(d.output) ? d.output : [];
  const parts: string[] = [];
  for (const item of output) {
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as Array<Record<string, unknown>>)
      : [];
    for (const c of content) {
      if (typeof c.text === 'string' && c.text.trim()) parts.push(c.text.trim());
    }
  }
  return parts.join('\n').trim();
}

function parseJsonBlock<T>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const sliced = start >= 0 && end >= start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(sliced) as T;
}

async function researchWithOpenAI(
  lat: number,
  lng: number,
  reverseAddress: string | null,
  nearby: NearbyCandidate[]
): Promise<WebResearchProfile> {
  const key = openAIKey();
  if (!key) throw new Error('OPENAI_API_KEY is not configured');

  const model = process.env.OPENAI_PIN_RESEARCH_MODEL?.trim() || 'gpt-4.1-mini';
  const nearbyText = nearby.length
    ? nearby
        .map(
          (c, i) =>
            `${i + 1}. ${c.name} | ${c.address ?? 'no address'} | phone: ${c.phone ?? 'n/a'} | website: ${c.website ?? 'n/a'}`
        )
        .join('\n')
    : 'No nearby Google Places candidates found.';

  const prompt = [
    'Identify the likely business/company at or immediately adjacent to this map pin.',
    PIN_RESEARCH_LLM_INDUSTRIAL_BIAS,
    'Use web search as needed. Prefer a specific industrial occupant (plant, warehouse, supplier) over retail, medical, or restaurant POIs.',
    'Never invent phone numbers or websites. If unsure, return null.',
    `Latitude: ${lat.toFixed(6)}`,
    `Longitude: ${lng.toFixed(6)}`,
    `Reverse-geocoded address: ${reverseAddress ?? 'unknown'}`,
    `Nearby Google candidates:\n${nearbyText}`,
    'Return ONLY JSON with this exact schema:',
    '{"companyName":string|null,"address":string|null,"phone":string|null,"website":string|null,"summary":string|null,"confidence":"high"|"medium"|"low"|null,"sources":[string]}'
  ].join('\n\n');

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      tools: [{ type: 'web_search_preview' }],
      input: prompt
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI web research failed: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw = extractResponseText(data);
  const parsed = parseJsonBlock<WebResearchProfile>(raw);
  return {
    companyName: parsed.companyName?.trim() || null,
    address: parsed.address?.trim() || null,
    phone: parsed.phone?.trim() || null,
    website: parsed.website?.trim() || null,
    summary: parsed.summary?.trim() || null,
    confidence: parsed.confidence?.trim() || null,
    sources: Array.isArray(parsed.sources) ? parsed.sources.filter(Boolean).slice(0, 8) : []
  };
}

function makePlacesContext(profile: WebResearchProfile): string | null {
  if (!profile.companyName) return null;
  const parts = [`Listed as: ${profile.companyName}`];
  if (profile.address) parts.push(`Address: ${profile.address}`);
  if (profile.phone) parts.push(`Phone (public): ${profile.phone}`);
  if (profile.website) parts.push(`Website: ${profile.website}`);
  if (profile.summary) parts.push(`Summary: ${profile.summary}`);
  parts.push('Source: GPT web research with Google Maps coordinate context.');
  return `${parts.join(' ')} `;
}

function makeResearchResult(profile: WebResearchProfile): PinPlaceResearchResult {
  const chosen: PinPlaceCandidate | null = profile.companyName
    ? {
        placeId: `gpt:${(profile.companyName || 'unknown').toLowerCase().replace(/\s+/g, '-')}`,
        name: profile.companyName,
        formattedAddress: profile.address,
        phone: profile.phone,
        website: profile.website,
        latitude: null,
        longitude: null,
        mapsUrl: profile.address
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.address)}`
          : null
      }
    : null;

  return {
    ok: true,
    cached: false,
    provider: 'gpt-web',
    llmProvider: 'openai',
    radiusMeters: DEFAULT_PIN_RESEARCH_RADIUS_METERS,
    candidates: chosen ? [chosen] : [],
    chosen,
    disambiguationNote: profile.confidence ? `Confidence: ${profile.confidence}` : null,
    webSummary: profile.summary,
    sources: profile.sources,
    confidence: profile.confidence
  };
}

async function updateMatchingTargets(
  lat: number,
  lng: number,
  profile: WebResearchProfile,
  dryRun: boolean
) {
  const dLat = decimalCoord(lat);
  const dLng = decimalCoord(lng);
  const matches = await prisma.target.findMany({
    where: { latitude: dLat, longitude: dLng },
    select: {
      id: true,
      company: true,
      addressRaw: true,
      phone: true,
      website: true,
      TargetEnrichment: {
        select: { id: true, enrichedJson: true }
      }
    }
  });

  const placesContext = makePlacesContext(profile);
  for (const target of matches) {
    if (!genericProspectName(target.company) && !dryRun) {
      continue;
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (profile.companyName && genericProspectName(target.company)) patch.company = profile.companyName;
    if (profile.address && !target.addressRaw) patch.addressRaw = profile.address;
    if (profile.phone && !target.phone) patch.phone = profile.phone;
    if (profile.website && !target.website) patch.website = profile.website;

    if (dryRun) {
      console.log(`  [dry-run] target ${target.id} ->`, patch);
    } else if (Object.keys(patch).length > 1) {
      await prisma.target.update({
        where: { id: target.id },
        data: patch
      });
    }

    const snapshot = {
      legalName: profile.companyName || target.company,
      industry: 'Unknown',
      employees: 0,
      siteFunction: 'Facility',
      summary: profile.summary ?? '',
      contactPhone: profile.phone ?? null
    };

    const previous =
      target.TargetEnrichment?.enrichedJson && typeof target.TargetEnrichment.enrichedJson === 'object'
        ? (target.TargetEnrichment.enrichedJson as Record<string, unknown>)
        : {};

    const enrichedJson = {
      ...previous,
      snapshot,
      places_context: placesContext,
      pin_research: {
        ...profile,
        researched_at: new Date().toISOString(),
        provider: 'openai-web-search'
      }
    };

    if (dryRun) {
      console.log(`  [dry-run] enrichment ${target.id} -> snapshot + pin_research`);
      continue;
    }

    await prisma.targetEnrichment.upsert({
      where: { targetId: target.id },
      create: {
        id: `enr_${target.id}`,
        targetId: target.id,
        enrichedJson,
        model: 'openai-web-search',
        updatedAt: new Date()
      },
      update: {
        enrichedJson,
        model: 'openai-web-search',
        updatedAt: new Date()
      }
    });
  }

  return matches.length;
}

async function main() {
  ({ prisma } = await import('../src/lib/prisma'));
  const pinLib = await import('../src/lib/pin-place-research');
  DEFAULT_PIN_RESEARCH_RADIUS_METERS = pinLib.DEFAULT_PIN_RESEARCH_RADIUS_METERS;
  pinResearchDefaultCacheKey = pinLib.pinResearchDefaultCacheKey;
  writePinResearchCache = pinLib.writePinResearchCache;

  const args = parseArgs(process.argv.slice(2));
  const openAi = openAIKey();
  const maps = googleKey();
  if (!openAi) throw new Error('OPENAI_API_KEY is required');
  if (!maps) throw new Error('GOOGLE_MAPS_API_KEY / GOOGLE_PLACES_API_KEY is required');

  const pins = await prisma.mapPin.findMany({
    where: { hidden: false },
    orderBy: { createdAt: 'asc' },
    take: args.limit > 0 ? args.limit : undefined,
    select: { id: true, latitude: true, longitude: true }
  });

  console.log(`Found ${pins.length} visible red pin(s). dryRun=${args.dryRun} force=${args.force}`);

  let processed = 0;
  for (const pin of pins) {
    const lat = Number(pin.latitude);
    const lng = Number(pin.longitude);
    const cacheKey = pinResearchDefaultCacheKey(lat, lng);

    if (!args.force && !args.dryRun) {
      const existing = await prisma.metaKV.findUnique({ where: { key: cacheKey }, select: { key: true } });
      if (existing) {
        console.log(`skip ${pin.id} (${lat.toFixed(5)}, ${lng.toFixed(5)}) cached`);
        continue;
      }
    }

    console.log(`research ${pin.id} (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
    const reverse = await reverseGeocode(lat, lng, maps);
    const nearby = await nearbyCandidates(lat, lng, maps);
    const profile = await researchWithOpenAI(lat, lng, reverse, nearby);
    const result = makeResearchResult(profile);

    if (args.dryRun) {
      console.log('  [dry-run] profile:', JSON.stringify(profile, null, 2));
    } else {
      await writePinResearchCache(cacheKey, result);
    }

    const updatedTargets = await updateMatchingTargets(lat, lng, profile, args.dryRun);
    console.log(
      `  -> ${profile.companyName ?? 'no match'} | targets touched: ${updatedTargets} | sources: ${profile.sources.length}`
    );
    processed += 1;
    if (args.sleepMs > 0) await sleep(args.sleepMs);
  }

  console.log(`Done. Processed ${processed} red pin(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
