/**
 * Map daysweeper Target to LastLeg Lead JSON format.
 */

function buildMapLinks(address: string): { appleMaps: string; googleMaps: string; googleEarth: string } {
  const q = encodeURIComponent(address);
  return {
    appleMaps: `https://maps.apple.com/?q=${q}`,
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${q}`,
    googleEarth: `https://earth.google.com/web/search/${q}`
  };
}

function pinResearchObject(enrichedJson: unknown): Record<string, unknown> | null {
  if (!enrichedJson || typeof enrichedJson !== 'object') return null;
  const pinResearch = (enrichedJson as Record<string, unknown>).pin_research;
  if (!pinResearch || typeof pinResearch !== 'object') return null;
  // Normalize snake_case keys (from Python scripts) to camelCase so the rest of the mapper works
  const pr = pinResearch as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...pr };
  if (!normalized.companyName && normalized.company_name) normalized.companyName = normalized.company_name;
  if (!normalized.alternativeNames && normalized.alternative_names) normalized.alternativeNames = normalized.alternative_names;
  if (!normalized.employeeSignal && normalized.employee_signal) normalized.employeeSignal = normalized.employee_signal;
  if (!normalized.parentCompany && normalized.parent_company) normalized.parentCompany = normalized.parent_company;
  return normalized;
}

function snapshotObject(enrichedJson: unknown): Record<string, unknown> | null {
  if (!enrichedJson || typeof enrichedJson !== 'object') return null;
  const snapshot = (enrichedJson as Record<string, unknown>).snapshot;
  return snapshot && typeof snapshot === 'object'
    ? (snapshot as Record<string, unknown>)
    : null;
}

function extractPlacesContext(enrichedJson: unknown): string | null {
  if (!enrichedJson || typeof enrichedJson !== 'object') return null;
  const obj = enrichedJson as Record<string, unknown>;
  const direct = obj.places_context;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const pinResearch = pinResearchObject(enrichedJson);
  if (pinResearch) {
    const researchSummary = pinResearch.summary;
    const companyName = pinResearch.companyName;
    const address = pinResearch.address;
    if (typeof companyName === 'string' && companyName.trim()) {
      const parts = [`Listed as: ${companyName.trim()}`];
      if (typeof address === 'string' && address.trim()) parts.push(`Address: ${address.trim()}`);
      if (typeof researchSummary === 'string' && researchSummary.trim()) {
        parts.push(`Summary: ${researchSummary.trim()}`);
      }
      parts.push('Source: GPT web research with Google Maps coordinate context.');
      return `${parts.join(' ')} `;
    }
  }
  return null;
}

/** Same idea as LastLeg `PlacesLookupService.parseListedAs` — use Google listing title for route rows. */
function listedAsFromPlacesContextString(pc: string): string | null {
  const key = 'Listed as: ';
  const idx = pc.indexOf(key);
  if (idx < 0) return null;
  let rest = pc.slice(idx + key.length).trim();
  const addrIdx = rest.indexOf(' Address:');
  if (addrIdx >= 0) rest = rest.slice(0, addrIdx).trim();
  else {
    const dot = rest.indexOf('.');
    if (dot >= 0) rest = rest.slice(0, dot).trim();
  }
  return rest.length > 0 ? rest : null;
}

function listedAsFromEnrichedJson(enrichedJson: unknown): string | null {
  if (!enrichedJson || typeof enrichedJson !== 'object') return null;
  const direct = (enrichedJson as Record<string, unknown>).places_context;
  if (typeof direct !== 'string' || !direct.trim()) return null;
  const name = listedAsFromPlacesContextString(direct.trim());
  if (!name || genericProspectName(name)) return null;
  return name;
}

function displayCompanyName(company: string, enrichedJson: unknown): string {
  if (!genericProspectName(company)) return company;
  if (!enrichedJson || typeof enrichedJson !== 'object') return company;
  const snapshot = snapshotObject(enrichedJson);
  if (snapshot && typeof snapshot === 'object') {
    const legalName = snapshot.legalName;
    if (typeof legalName === 'string' && legalName.trim()) return legalName.trim();
  }
  const pinResearch = pinResearchObject(enrichedJson);
  if (pinResearch) {
    const companyName = pinResearch.companyName;
    if (typeof companyName === 'string' && companyName.trim()) return companyName.trim();
  }
  const listed = listedAsFromEnrichedJson(enrichedJson);
  if (listed) return listed;
  return company;
}

function genericProspectName(name: string): boolean {
  const t = name.trim();
  return (
    /^prospect(\s+\d+)?$/i.test(t) ||
    /^pin(\s+\d+)?$/i.test(t) ||
    /^untitled placemark$/i.test(t)
  );
}

function stringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function numberOrNull(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v;
}

function mapPinKindFromLegacy(legacyJson: unknown): 'seller' | 'container' {
  if (legacyJson && typeof legacyJson === 'object') {
    const o = legacyJson as Record<string, unknown>;
    const k = o.daysweeper_pin_kind ?? o.map_pin_kind;
    if (typeof k === 'string') {
      const t = k.trim().toLowerCase();
      // `buyer` was the legacy value before isSeller rename; treat as seller pin for LastLeg.
      if (t === 'seller' || t === 'buyer') return 'seller';
    }
  }
  return 'container';
}

/** LastLeg iOS: grey seller pins when `map_pin_kind` / `seller_id` decode (snake_case). */
function mapPinKindForLead(
  legacyJson: unknown,
  category: string | null | undefined
): 'seller' | 'container' {
  if (mapPinKindFromLegacy(legacyJson) === 'seller') return 'seller';
  const c = typeof category === 'string' ? category.trim().toLowerCase() : '';
  if (c === 'seller') return 'seller';
  return 'container';
}

/**
 * Expose seller company id for LastLeg (`seller_id` on lead JSON).
 * Accepts legacy `seller_id` / `sellerId`, or `companyId` when pin is seller-flavored.
 */
function sellerIdForLead(
  legacyJson: unknown,
  category: string | null | undefined
): string | null {
  if (!legacyJson || typeof legacyJson !== 'object') return null;
  const o = legacyJson as Record<string, unknown>;
  const sid = o.sellerId ?? o.seller_id;
  if (typeof sid === 'string' && sid.trim()) return sid.trim();
  if (mapPinKindForLead(legacyJson, category) !== 'seller') return null;
  const companyId = o.companyId ?? o.company_id;
  return typeof companyId === 'string' && companyId.trim() ? companyId.trim() : null;
}

export type TargetToLeadOptions = {
  /**
   * When a route `Target` matches a CRM seller (`Company.isSeller` + legacy companyId or
   * coordinate match). Forces LastLeg `map_pin_kind` / `seller_id` for iOS grey layer.
   */
  resolvedSellerCompanyId?: string | null;
};

export function targetToLead(
  target: {
    id: string;
    company: string;
    parentCompany?: string | null;
    website?: string | null;
    phone?: string | null;
    email?: string | null;
    /** When `'SELLER'` (e.g. add-to-route vendor path), LastLeg treats the lead as a seller pin. */
    category?: string | null;
    segment?: string | null;
    addressRaw?: string | null;
    addressNormalized?: string | null;
    latitude?: unknown;
    longitude?: unknown;
    accountState?: string | null;
    legacyJson?: unknown;
    RouteStop?: Array<{ seq: number; outcome?: string | null }>;
    TargetEnrichment?: { enrichedJson?: unknown } | null;
  },
  options?: TargetToLeadOptions
) {
  const lat = target.latitude != null ? Number(target.latitude) : null;
  const lng = target.longitude != null ? Number(target.longitude) : null;
  const seq = target.RouteStop?.[0]?.seq;
  const routeOutcome = target.RouteStop?.[0]?.outcome ?? null;
  const enrichedJson = target.TargetEnrichment?.enrichedJson;
  const company = displayCompanyName(target.company, enrichedJson);
  const pinResearch = pinResearchObject(enrichedJson);
  const snapshot = snapshotObject(enrichedJson);
  const address =
    target.addressRaw ??
    target.addressNormalized ??
    stringOrNull(pinResearch?.address) ??
    '';
  const website = target.website ?? stringOrNull(pinResearch?.website);
  const phone =
    target.phone ??
    stringOrNull(pinResearch?.phone) ??
    stringOrNull(snapshot?.contactPhone);

  const dbSellerId = options?.resolvedSellerCompanyId?.trim() || null;
  const map_pin_kind: 'seller' | 'container' = dbSellerId
    ? 'seller'
    : mapPinKindForLead(target.legacyJson, target.category);
  const seller_id: string | null =
    dbSellerId ?? sellerIdForLead(target.legacyJson, target.category);

  return {
    id: target.id,
    company,
    parent_company: target.parentCompany ?? null,
    website: website ?? null,
    category: target.category ?? '',
    segment: target.segment ?? '',
    address: address || null,
    address_raw: address || null,
    address_normalized: target.addressNormalized ?? null,
    phone: phone ?? null,
    latitude: lat,
    longitude: lng,
    places_context: extractPlacesContext(enrichedJson),
    pin_research: pinResearch
      ? {
          company_name: stringOrNull(pinResearch.companyName),
          alternative_names: Array.isArray(pinResearch.alternativeNames)
            ? (pinResearch.alternativeNames as unknown[]).filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
            : [],
          address: stringOrNull(pinResearch.address),
          phone: stringOrNull(pinResearch.phone),
          email: stringOrNull(pinResearch.email),
          website: stringOrNull(pinResearch.website),
          industry: stringOrNull(pinResearch.industry),
          summary: stringOrNull(pinResearch.summary),
          employee_signal: stringOrNull(pinResearch.employeeSignal),
          parent_company: stringOrNull(pinResearch.parentCompany),
          confidence: stringOrNull(pinResearch.confidence),
          sources: Array.isArray(pinResearch.sources)
            ? pinResearch.sources
                .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
                .slice(0, 8)
            : []
        }
      : null,
    facility_snapshot: snapshot
      ? {
          legal_name: stringOrNull(snapshot.legalName),
          industry: stringOrNull(snapshot.industry),
          employees: numberOrNull(snapshot.employees),
          site_function: stringOrNull(snapshot.siteFunction),
          summary: stringOrNull(snapshot.summary),
          contact_phone: stringOrNull(snapshot.contactPhone)
        }
      : null,
    links: buildMapLinks(address || company),
    account_state: target.accountState ?? null,
    route_outcome: routeOutcome,
    s: seq ?? null,
    /** LastLeg: grey active pins for seller / vendor-research companies (decoder expects snake_case). */
    map_pin_kind,
    seller_id
  };
}
