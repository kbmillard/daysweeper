/**
 * Resolve map pin coordinates to nearby places (Google Places) with optional LLM disambiguation.
 * Phone numbers should be treated as Places-sourced when present; LLM output is advisory only.
 */
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

export type PinPlaceCandidate = {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  phone: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
};

export type PinPlaceResearchResult = {
  ok: true;
  cached: boolean;
  provider: 'places' | 'places+llm';
  llmProvider: 'none' | 'gemini' | 'openai' | 'anthropic';
  radiusMeters: number;
  candidates: PinPlaceCandidate[];
  chosen: PinPlaceCandidate | null;
  disambiguationNote: string | null;
};

const CACHE_PREFIX = 'pin_place_research:v2:';

function googlePlacesKey(): string {
  return (
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    ''
  );
}

export function pinResearchCacheKey(
  lat: number,
  lng: number,
  hint: string,
  radiusMeters: number
): string {
  const la = Math.round(lat * 1e5) / 1e5;
  const lo = Math.round(lng * 1e5) / 1e5;
  const h = hint.trim()
    ? createHash('sha256').update(hint.trim().toLowerCase()).digest('hex').slice(0, 12)
    : 'nohint';
  return `${CACHE_PREFIX}${la}:${lo}:${h}:r${radiusMeters}`;
}

type NearbyResult = { results?: Array<{ place_id?: string; name?: string; vicinity?: string }> };
type DetailsResult = {
  result?: {
    place_id?: string;
    name?: string;
    formatted_address?: string;
    formatted_phone_number?: string;
    international_phone_number?: string;
    website?: string;
    url?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
  };
};

async function nearbySearch(
  lat: number,
  lng: number,
  radiusMeters: number,
  keyword: string | undefined,
  key: string
): Promise<Array<{ place_id: string; name: string; vicinity?: string }>> {
  const u = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  u.searchParams.set('location', `${lat},${lng}`);
  u.searchParams.set('radius', String(radiusMeters));
  u.searchParams.set('key', key);
  if (keyword?.trim()) u.searchParams.set('keyword', keyword.trim().slice(0, 80));

  const res = await fetch(u.toString(), { next: { revalidate: 0 } });
  if (!res.ok) return [];
  const data = (await res.json()) as NearbyResult & { status?: string; error_message?: string };
  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error('[pin-place-research] nearby status:', data.status, data.error_message);
    return [];
  }
  const out: Array<{ place_id: string; name: string; vicinity?: string }> = [];
  for (const r of data.results ?? []) {
    if (r.place_id && r.name) out.push({ place_id: r.place_id, name: r.name, vicinity: r.vicinity });
    if (out.length >= 8) break;
  }
  return out;
}

async function placeDetails(
  placeId: string,
  key: string
): Promise<PinPlaceCandidate | null> {
  const u = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  u.searchParams.set('place_id', placeId);
  u.searchParams.set(
    'fields',
    'place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,geometry,url'
  );
  u.searchParams.set('key', key);

  const res = await fetch(u.toString(), { next: { revalidate: 0 } });
  if (!res.ok) return null;
  const data = (await res.json()) as DetailsResult & { status?: string };
  if (data.status !== 'OK' || !data.result) return null;
  const r = data.result;
  const lat = r.geometry?.location?.lat ?? null;
  const lng = r.geometry?.location?.lng ?? null;
  return {
    placeId: r.place_id ?? placeId,
    name: r.name ?? 'Unknown',
    formattedAddress: r.formatted_address ?? null,
    phone: r.formatted_phone_number ?? r.international_phone_number ?? null,
    website: r.website ?? null,
    latitude: lat,
    longitude: lng,
    mapsUrl: r.url ?? null
  };
}

type Disambiguation = { chosenIndex: number | null; note: string | null };

const PIN_RESEARCH_LLM = (process.env.PIN_RESEARCH_LLM ?? 'gemini').trim().toLowerCase();
const GEMINI_PIN_MODEL =
  process.env.GEMINI_PIN_RESEARCH_MODEL?.trim() || 'gemini-2.5-flash-lite';
const OPENAI_PIN_MODEL = process.env.OPENAI_PIN_RESEARCH_MODEL?.trim() || 'gpt-4o-mini';
const ANTHROPIC_PIN_MODEL =
  process.env.ANTHROPIC_PIN_RESEARCH_MODEL?.trim() || 'claude-3-5-haiku-20241022';

function extractGeminiText(candidate: { content?: { parts?: Array<{ text?: string }> } }): string {
  const parts = candidate?.content?.parts ?? [];
  for (let i = parts.length - 1; i >= 0; i--) {
    const t = parts[i]?.text;
    if (typeof t === 'string' && t.trim()) return t;
  }
  return '';
}

async function disambiguateWithGemini(
  hint: string,
  candidates: PinPlaceCandidate[]
): Promise<Disambiguation> {
  const key = process.env.GEMINI_API_KEY ?? '';
  if (!key) return { chosenIndex: null, note: null };

  const list = candidates
    .map(
      (c, i) =>
        `${i}. ${c.name} | ${c.formattedAddress ?? 'no address'} | phone: ${c.phone ?? 'n/a'}`
    )
    .join('\n');

  const prompt = `You pick which Google Places result best matches a map pin. User hint (may be empty): "${hint || '(none)'}"

Candidates (index 0-based):
${list}

Reply with ONLY valid JSON: {"chosenIndex":null or 0..${candidates.length - 1},"note":"short reason"}
If none fit, chosenIndex null. Never invent phone numbers; indices only.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_PIN_MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 256 }
    })
  });
  if (!res.ok) return { chosenIndex: null, note: null };
  const data = await res.json();
  const raw = extractGeminiText(data?.candidates?.[0] ?? {});
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    const j = JSON.parse(cleaned) as { chosenIndex?: number | null; note?: string };
    const idx = j.chosenIndex;
    if (idx == null || typeof idx !== 'number') return { chosenIndex: null, note: j.note ?? null };
    if (idx < 0 || idx >= candidates.length) return { chosenIndex: null, note: j.note ?? null };
    return { chosenIndex: idx, note: j.note ?? null };
  } catch {
    return { chosenIndex: null, note: null };
  }
}

async function disambiguateWithOpenAI(
  hint: string,
  candidates: PinPlaceCandidate[]
): Promise<Disambiguation> {
  const key = process.env.OPENAI_API_KEY ?? '';
  if (!key) return { chosenIndex: null, note: null };

  const list = candidates
    .map(
      (c, i) =>
        `${i}. ${c.name} | ${c.formattedAddress ?? 'no address'} | phone: ${c.phone ?? 'n/a'}`
    )
    .join('\n');

  const prompt = `Pick which place best matches the map pin. Hint: "${hint || '(none)'}". Candidates:\n${list}\nJSON only: {"chosenIndex":number or null,"note":"string"}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_PIN_MODEL,
      temperature: 0.1,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!res.ok) return { chosenIndex: null, note: null };
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    const j = JSON.parse(cleaned) as { chosenIndex?: number | null; note?: string };
    const idx = j.chosenIndex;
    if (idx == null || typeof idx !== 'number') return { chosenIndex: null, note: j.note ?? null };
    if (idx < 0 || idx >= candidates.length) return { chosenIndex: null, note: j.note ?? null };
    return { chosenIndex: idx, note: j.note ?? null };
  } catch {
    return { chosenIndex: null, note: null };
  }
}

async function disambiguateWithAnthropic(
  hint: string,
  candidates: PinPlaceCandidate[]
): Promise<Disambiguation> {
  const key = process.env.ANTHROPIC_API_KEY ?? '';
  if (!key) return { chosenIndex: null, note: null };

  const list = candidates
    .map(
      (c, i) =>
        `${i}. ${c.name} | ${c.formattedAddress ?? 'no address'} | phone: ${c.phone ?? 'n/a'}`
    )
    .join('\n');

  const prompt = `Pick which place best matches the map pin. Hint: "${hint || '(none)'}". Candidates:\n${list}\nReply with only JSON: {"chosenIndex":number or null,"note":"string"}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: ANTHROPIC_PIN_MODEL,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!res.ok) return { chosenIndex: null, note: null };
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  const raw = data.content?.[0]?.text?.trim() ?? '';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    const j = JSON.parse(cleaned) as { chosenIndex?: number | null; note?: string };
    const idx = j.chosenIndex;
    if (idx == null || typeof idx !== 'number') return { chosenIndex: null, note: j.note ?? null };
    if (idx < 0 || idx >= candidates.length) return { chosenIndex: null, note: j.note ?? null };
    return { chosenIndex: idx, note: j.note ?? null };
  } catch {
    return { chosenIndex: null, note: null };
  }
}

async function runDisambiguation(
  hint: string,
  candidates: PinPlaceCandidate[]
): Promise<{ chosen: PinPlaceCandidate | null; note: string | null; llm: PinPlaceResearchResult['llmProvider'] }> {
  if (candidates.length === 0) {
    return { chosen: null, note: null, llm: 'none' };
  }
  if (candidates.length === 1) {
    return { chosen: candidates[0]!, note: null, llm: 'none' };
  }

  const mode = PIN_RESEARCH_LLM;
  if (mode === 'none') {
    return { chosen: candidates[0]!, note: 'Multiple matches; first result returned (LLM disabled).', llm: 'none' };
  }

  let d: Disambiguation = { chosenIndex: null, note: null };
  let llm: PinPlaceResearchResult['llmProvider'] = 'none';

  if (mode === 'openai') {
    d = await disambiguateWithOpenAI(hint, candidates);
    llm = 'openai';
  } else if (mode === 'anthropic') {
    d = await disambiguateWithAnthropic(hint, candidates);
    llm = 'anthropic';
  } else {
    d = await disambiguateWithGemini(hint, candidates);
    llm = 'gemini';
  }

  if (d.chosenIndex != null && candidates[d.chosenIndex]) {
    return { chosen: candidates[d.chosenIndex]!, note: d.note, llm };
  }
  return {
    chosen: candidates[0]!,
    note: d.note ?? 'LLM did not pick; using first candidate.',
    llm
  };
}

export async function readPinResearchCache(key: string): Promise<PinPlaceResearchResult | null> {
  try {
    const row = await prisma.metaKV.findUnique({ where: { key } });
    if (!row?.value || typeof row.value !== 'object') return null;
    const v = row.value as Record<string, unknown>;
    if (v.schema !== 'pin_place_research_v2') return null;
    return v.payload as PinPlaceResearchResult;
  } catch {
    return null;
  }
}

export async function writePinResearchCache(key: string, payload: PinPlaceResearchResult): Promise<void> {
  try {
    await prisma.metaKV.upsert({
      where: { key },
      create: {
        key,
        value: { schema: 'pin_place_research_v2', payload }
      },
      update: { value: { schema: 'pin_place_research_v2', payload } }
    });
  } catch (e) {
    console.error('[pin-place-research] cache write failed:', e);
  }
}

export async function researchPinPlace(options: {
  latitude: number;
  longitude: number;
  hint?: string;
  radiusMeters?: number;
  skipCache?: boolean;
}): Promise<PinPlaceResearchResult> {
  const { latitude, longitude, hint = '', radiusMeters = 120, skipCache = false } = options;

  const key = googlePlacesKey();
  const cacheKey = pinResearchCacheKey(latitude, longitude, hint, radiusMeters);

  if (!skipCache) {
    const cached = await readPinResearchCache(cacheKey);
    if (cached) return { ...cached, cached: true };
  }

  if (!key) {
    throw new Error('GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY is not configured');
  }

  const nearby = await nearbySearch(latitude, longitude, radiusMeters, hint || undefined, key);
  const detailIds = nearby.slice(0, 5).map((n) => n.place_id);
  const candidates: PinPlaceCandidate[] = [];
  for (const pid of detailIds) {
    const d = await placeDetails(pid, key);
    if (d) candidates.push(d);
  }

  const { chosen, note, llm } = await runDisambiguation(hint, candidates);

  const provider: PinPlaceResearchResult['provider'] =
    llm === 'none' ? 'places' : 'places+llm';

  const result: PinPlaceResearchResult = {
    ok: true,
    cached: false,
    provider,
    llmProvider: llm,
    radiusMeters,
    candidates,
    chosen,
    disambiguationNote: note
  };

  await writePinResearchCache(cacheKey, result);
  return result;
}
