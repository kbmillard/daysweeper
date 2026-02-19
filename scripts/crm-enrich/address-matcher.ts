/**
 * Match extracted addresses (from official sites) to existing locations.
 * Match by city/state/zip first; if multiple, use best string similarity with addressRaw.
 */

import type { ExtractedAddress } from "./types.js";
import type { LocationFlat } from "./types.js";

export function matchAddressToLocations(
  extracted: ExtractedAddress[],
  locations: LocationFlat[],
  options?: { requireStreetInExtracted?: boolean }
): Map<string, string> {
  const locationIdToUpdatedAddress = new Map<string, string>();
  const requireStreet = options?.requireStreetInExtracted ?? true;

  for (const loc of locations) {
    const city = (loc.addressComponents?.city ?? "").trim().toLowerCase();
    const state = (loc.addressComponents?.state ?? loc.addressComponents?.addressRegion ?? "").trim().toLowerCase().replace(/\s/g, "");
    const zip = (loc.addressComponents?.postal_code ?? loc.addressComponents?.postalCode ?? "").trim().replace(/\s/g, "");

    if (!city && !state && !zip) continue;
    const candidates = extracted.filter((e) => {
      const eCity = (e.city ?? "").toLowerCase();
      const eState = (e.state ?? "").toLowerCase().replace(/\s/g, "");
      const eZip = (e.postalCode ?? "").replace(/\s/g, "");
      const cityMatch = !city || !eCity || eCity.includes(city) || city.includes(eCity);
      const stateMatch = !state || !eState || eState === state || (eState.length === 2 && state.length === 2 && eState === state);
      const zipMatch = !zip || !eZip || eZip.includes(zip) || zip.includes(eZip);
      if (!cityMatch || !stateMatch || !zipMatch) return false;
      if (requireStreet && !hasStreetNumber(e.raw)) return false;
      return true;
    });
    if (candidates.length === 0) continue;
    const best = selectBestMatch(candidates, loc.addressRaw);
    if (best && isBetterThanExisting(best.raw, loc.addressRaw)) {
      locationIdToUpdatedAddress.set(loc.externalId, best.raw);
    }
  }

  return locationIdToUpdatedAddress;
}

function hasStreetNumber(raw: string): boolean {
  return /\d+[\s\w.]+\s+(st|street|ave|avenue|blvd|drive|dr|road|rd|way|ln|lane|cir|ct|court)/i.test(raw)
    || /^\d+\s+[A-Za-z]/.test(raw.trim());
}

function isBetterThanExisting(newAddr: string, existing: string): boolean {
  const existingHasStreet = hasStreetNumber(existing);
  const newHasStreet = hasStreetNumber(newAddr);
  if (newHasStreet && !existingHasStreet) return true;
  if (newHasStreet && existingHasStreet) return newAddr.length >= existing.length;
  return false;
}

function selectBestMatch(candidates: ExtractedAddress[], existingAddressRaw: string): ExtractedAddress | null {
  if (candidates.length === 1) return candidates[0];
  let best: ExtractedAddress | null = null;
  let bestScore = -1;
  const existing = existingAddressRaw.trim().toLowerCase();
  for (const c of candidates) {
    const raw = c.raw.trim().toLowerCase();
    const sim = stringSimilarity(raw, existing);
    if (sim > bestScore) {
      bestScore = sim;
      best = c;
    }
  }
  return best;
}

function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const ta = a.replace(/\s+/g, " ");
  const tb = b.replace(/\s+/g, " ");
  const wordsA = new Set(ta.split(" ").filter(Boolean));
  const wordsB = new Set(tb.split(" ").filter(Boolean));
  let match = 0;
  for (const w of Array.from(wordsA)) {
    if (wordsB.has(w)) match++;
    else if (Array.from(wordsB).some((x) => x.includes(w) || w.includes(x))) match += 0.5;
  }
  const denom = Math.max(wordsA.size, wordsB.size, 1);
  return match / denom;
}
