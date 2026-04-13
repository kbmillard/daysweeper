import { Prisma, type PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

function addressComponentsInput(
  v: unknown
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (v === undefined) return undefined;
  if (v === null) return Prisma.JsonNull;
  return v as Prisma.InputJsonValue;
}

/** Same org may appear as `toyodagosei.com` vs `toyoda-gosei.com` across exports. */
function companyKeyLookupVariants(key: string): string[] {
  const k = key.trim().toLowerCase();
  if (!k) return [];
  const noHyphen = k.replace(/-/g, '');
  return Array.from(new Set([k, noHyphen].filter(Boolean)));
}

function hostKeyFromWebsite(website: string | null | undefined): string | null {
  if (!website?.trim()) return null;
  try {
    const u = website.includes('://') ? new URL(website) : new URL(`https://${website}`);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

/** Align GPT vs DB address strings for master lookup. */
function normalizeAddressRawForMatch(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\b(suite|ste|unit|bldg|building)\b\.?/g, ' ')
    .replace(/\b(us|usa)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addressComponentsMatchKey(
  companyKeyNorm: string,
  addressComponents: unknown
): string | null {
  if (!companyKeyNorm || !addressComponents || typeof addressComponents !== 'object') return null;
  const o = addressComponents as Record<string, unknown>;
  const city = String(o.city ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const state = String(o.state ?? '').toLowerCase().trim();
  const zip = String(o.postal_code ?? o.postalCode ?? '')
    .replace(/\s/g, '')
    .trim();
  if (!city || !state) return null;
  return `${companyKeyNorm}|${city}|${state}|${zip}`;
}

type MasterLocationHit = {
  companyExternalId: string;
  locationExternalId: string;
};

type MasterLocationIndexes = {
  byKeyNormAddr: Map<string, MasterLocationHit>;
  byKeyCityStateZip: Map<string, MasterLocationHit>;
};

/**
 * Build lookup maps from existing DB rows (canonical master). Incoming GPT batches are remapped
 * to these ids before upsert so parent `externalId`s and dedupe match the first ~746+ imports.
 */
async function buildCrmMasterLocationIndexes(
  prisma: PrismaClient
): Promise<MasterLocationIndexes> {
  const rows = await prisma.location.findMany({
    where: { externalId: { not: null } },
    select: {
      externalId: true,
      addressRaw: true,
      addressComponents: true,
      Company: { select: { externalId: true, companyKey: true } }
    }
  });

  const byKeyNormAddr = new Map<string, MasterLocationHit>();
  const byKeyCityStateZip = new Map<string, MasterLocationHit>();

  for (const loc of rows) {
    const ce = loc.Company.externalId;
    const le = loc.externalId;
    if (!ce || !le) continue;

    const normAddr = normalizeAddressRawForMatch(loc.addressRaw);
    const keyVariants = companyKeyLookupVariants(loc.Company.companyKey ?? '');
    for (const key of keyVariants) {
      if (!key) continue;
      const addrKey = `${key}|${normAddr}`;
      if (!byKeyNormAddr.has(addrKey)) {
        byKeyNormAddr.set(addrKey, {
          companyExternalId: ce,
          locationExternalId: le
        });
      }
      const ck = addressComponentsMatchKey(key, loc.addressComponents);
      if (ck && !byKeyCityStateZip.has(ck)) {
        byKeyCityStateZip.set(ck, {
          companyExternalId: ce,
          locationExternalId: le
        });
      }
    }
  }

  return { byKeyNormAddr, byKeyCityStateZip };
}

function lookupMasterLocationHit(
  supplier: CrmSupplierJson,
  indexes: MasterLocationIndexes
): MasterLocationHit | null {
  const normAddr = normalizeAddressRawForMatch(supplier.addressRaw ?? '');
  const keyCandidates = [
    ...companyKeyLookupVariants(supplier.companyKey ?? ''),
    ...(supplier.companyKey?.trim()
      ? []
      : companyKeyLookupVariants(hostKeyFromWebsite(supplier.website) ?? ''))
  ];
  const uniqKeys = Array.from(new Set(keyCandidates.filter(Boolean)));

  for (const key of uniqKeys) {
    const hitAddr = indexes.byKeyNormAddr.get(`${key}|${normAddr}`);
    if (hitAddr) return hitAddr;
  }

  const ac = supplier.addressComponents;
  for (const key of uniqKeys) {
    const ck = addressComponentsMatchKey(key, ac);
    if (ck) {
      const hit = indexes.byKeyCityStateZip.get(ck);
      if (hit) return hit;
    }
  }

  return null;
}

/**
 * Serialize a supplier row for JSON columns (drops functions; ChatGPT objects are plain data).
 */
function crmRowToJsonRecord(s: CrmSupplierJson): Record<string, unknown> {
  return JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
}

function mergeCompanyMetadata(
  prior: unknown,
  opts: {
    mergedKeywords: string[];
    mergedTags: string[];
    mergedProducts: string[];
    batchRows: Record<string, unknown>[];
    now: Date;
  }
): Prisma.InputJsonValue {
  const p =
    prior && typeof prior === 'object' && !Array.isArray(prior)
      ? { ...(prior as Record<string, unknown>) }
      : {};
  const prevImports = Array.isArray(p._crmFullImports) ? [...p._crmFullImports] : [];
  prevImports.push({
    at: opts.now.toISOString(),
    rows: opts.batchRows
  });

  const prevKw = Array.isArray(p.industryKeywords)
    ? (p.industryKeywords as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const prevTags = Array.isArray(p.capabilityTags)
    ? (p.capabilityTags as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const prevProd = Array.isArray(p.keyProducts)
    ? (p.keyProducts as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  return {
    ...p,
    industryKeywords: Array.from(new Set([...prevKw, ...opts.mergedKeywords])),
    capabilityTags: Array.from(new Set([...prevTags, ...opts.mergedTags])),
    keyProducts: Array.from(new Set([...prevProd, ...opts.mergedProducts])),
    _crmFullImports: prevImports,
    _importedAt: opts.now.toISOString(),
    _importSource: 'crm_import_v1'
  } as Prisma.InputJsonValue;
}

function mergeLocationLegacyJson(
  prior: unknown,
  row: Record<string, unknown>,
  now: Date
): Prisma.InputJsonValue {
  const p =
    prior && typeof prior === 'object' && !Array.isArray(prior)
      ? { ...(prior as Record<string, unknown>) }
      : {};
  const prevImports = Array.isArray(p._crmFullImports) ? [...p._crmFullImports] : [];
  prevImports.push({ at: now.toISOString(), row });
  return {
    ...p,
    _crmFullImports: prevImports,
    _importedAt: now.toISOString(),
    _importSource: 'crm_import_v1'
  } as Prisma.InputJsonValue;
}

/**
 * Subset of GPT supplier JSON that Daysweeper maps to columns; extra keys are kept on the object
 * and stored under metadata / legacyJson `_crmFullImports`.
 */
export type CrmSupplierJson = {
  company: string;
  parentCompany?: string | null;
  website?: string | null;
  phone?: string | null;
  addressRaw?: string;
  addressComponents?: unknown;
  tier?: string | null;
  supplyChainCategory?: string | null;
  supplyChainSubtypeGroup?: string | null;
  supplyChainSubtype?: string | null;
  segment?: string | null;
  companyId?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  companyKey?: string | null;
  parentCompanyId?: string | null;
  industryKeywords?: string[] | null;
  capabilityTags?: string[] | null;
  keyProducts?: string[] | null;
  contactInfo?: {
    phone?: string | null;
    email?: string | null;
  } | null;
} & Record<string, unknown>;

export type CrmSupplierImportResult = {
  companiesCreated: number;
  companiesTotal: number;
  parentsLinked: number;
  locationsCreated: number;
  /** Rows whose companyId/locationId were replaced from an existing DB location (canonical master). */
  rowsRemappedToDbMaster: number;
  /**
   * Unique `Location.externalId` values upserted in this run (after master remapping).
   * Used to geocode newly touched rows without scanning the whole backlog first.
   */
  locationExternalIdsTouched: string[];
};

type RowPair = {
  eff: CrmSupplierJson;
  orig: Record<string, unknown>;
  matchedDb: boolean;
};

function clusterRowPairs(pairs: RowPair[]): Map<string, RowPair[]> {
  const m = new Map<string, RowPair[]>();
  for (const p of pairs) {
    if (!p.eff.companyId?.trim() || !p.eff.company?.trim()) continue;
    const k = p.eff.companyId.trim();
    const arr = m.get(k) ?? [];
    arr.push(p);
    m.set(k, arr);
  }
  return m;
}

/**
 * Master JSON and ad-hoc GPT batches often disagree on `cmp_*` ids. Parent link first tries
 * `Company.externalId === parentCompanyId`, then same-`companyKey` rows with a matching name.
 */
async function resolveParentCompanyDbId(
  prisma: PrismaClient,
  opts: {
    externalParentId: string;
    parentCompany: string | null;
    companyKey: string | null;
    childCompanyDbId: string;
  }
): Promise<{ id: string; via: 'externalId' | 'companyKeyName' } | null> {
  const parentByExt = await prisma.company.findUnique({
    where: { externalId: opts.externalParentId }
  });
  if (parentByExt) return { id: parentByExt.id, via: 'externalId' };

  const parentLabel = opts.parentCompany?.trim();
  const rawKey = opts.companyKey?.trim();
  if (!parentLabel || !rawKey) return null;

  const keyVariants = companyKeyLookupVariants(rawKey);
  const candidates = await prisma.company.findMany({
    where: {
      id: { not: opts.childCompanyDbId },
      companyKey: { in: keyVariants }
    },
    select: { id: true, name: true, createdAt: true },
    take: 80
  });
  if (candidates.length === 0) return null;

  const pl = parentLabel.toLowerCase();

  const stemWords = pl
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2);

  const scored = candidates.map((c) => {
    const nl = c.name.toLowerCase();
    let score = 0;
    if (nl === pl) score = 100;
    else if (nl.startsWith(`${pl} `) || nl.startsWith(`${pl},`)) score = 75;
    else if (
      stemWords.length === 2 &&
      nl.includes(stemWords[0]!) &&
      nl.includes(stemWords[1]!)
    )
      score = 55;
    else if (pl.length >= 4 && nl.includes(pl)) score = 35;
    return { c, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.c.createdAt.getTime() - b.c.createdAt.getTime();
  });

  const best = scored[0];
  if (best.score < 35) return null;
  return { id: best.c.id, via: 'companyKeyName' };
}

/**
 * Shared CRM supplier import (companies + parent links + locations).
 * Remaps each row to existing DB `companyId`/`locationId` when `companyKey` + address match the
 * canonical master already in Postgres, then upserts. Full GPT payloads are appended to
 * `Company.metadata._crmFullImports` and `Location.legacyJson._crmFullImports`.
 */
export async function runCrmSupplierImport(
  prisma: PrismaClient,
  suppliers: CrmSupplierJson[]
): Promise<CrmSupplierImportResult> {
  const now = new Date();
  const indexes = await buildCrmMasterLocationIndexes(prisma);

  const pairs: RowPair[] = suppliers.map((s) => {
    const orig = crmRowToJsonRecord(s);
    const hit = lookupMasterLocationHit(s, indexes);
    if (!hit) {
      return { eff: s, orig, matchedDb: false };
    }
    return {
      eff: {
        ...s,
        companyId: hit.companyExternalId,
        locationId: hit.locationExternalId
      },
      orig,
      matchedDb: true
    };
  });

  const rowsRemappedToDbMaster = pairs.filter((p) => p.matchedDb).length;

  const companyMap = new Map<string, string>();
  const parentMap = new Map<
    string,
    { externalParentId: string; parentCompany: string | null; companyKey: string | null }
  >();
  const clusterSizes = new Map<string, number>();
  const companyIdsMatchedToMaster = new Set<string>();

  let companiesCreated = 0;

  for (const p of pairs) {
    if (p.matchedDb && p.eff.companyId?.trim()) {
      companyIdsMatchedToMaster.add(p.eff.companyId.trim());
    }
  }

  const clusters = clusterRowPairs(pairs);
  const existingCompaniesForPreserve = await prisma.company.findMany({
    where: { externalId: { in: Array.from(clusters.keys()) } },
    select: { externalId: true, externalParentId: true, metadata: true }
  });
  const existingByExternalId = new Map(
    existingCompaniesForPreserve.map((c) => [c.externalId!, c])
  );

  for (const [externalId, group] of Array.from(clusters.entries())) {
    clusterSizes.set(externalId, group.length);
    const primary = group[0]!.eff;
    const multi = group.length > 1;
    const parentDisplay = primary.parentCompany?.trim();
    let companyName = primary.company.trim();
    const uuidPattern = /^x[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$/;
    if (uuidPattern.test(companyName)) {
      companyName = companyName.substring(1);
    }
    const uniformSiteLabel =
      multi &&
      group.every((g) => g.eff.company.trim() === primary.company.trim());
    // Gestamp-style: one legal entity id, different `company` per row → roll up to parent name.
    // Highlands-style: same operating name on every row → keep `company`, do not swap in parent.
    if (multi && parentDisplay && !uniformSiteLabel) {
      companyName = parentDisplay;
    }

    const mergedKeywords = Array.from(
      new Set(
        group
          .flatMap((g) => g.eff.industryKeywords ?? [])
          .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
          .map((k) => k.trim())
      )
    );
    const mergedTags = Array.from(
      new Set(
        group
          .flatMap((g) => g.eff.capabilityTags ?? [])
          .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
          .map((k) => k.trim())
      )
    );
    const mergedProducts = Array.from(
      new Set(
        group
          .flatMap((g) => g.eff.keyProducts ?? [])
          .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
          .map((k) => k.trim())
      )
    );

    const existing = existingByExternalId.get(externalId);
    const preserveParent =
      !!existing && companyIdsMatchedToMaster.has(externalId);

    const batchRows = group.map((g) => g.orig);

    const company = await prisma.company.upsert({
      where: { externalId },
      update: {
        name: companyName,
        companyKey: primary.companyKey ?? null,
        website: primary.website ?? null,
        phone: primary.contactInfo?.phone ?? primary.phone ?? null,
        email: primary.contactInfo?.email ?? null,
        tier: primary.tier ?? null,
        segment: primary.segment ?? null,
        category: primary.supplyChainCategory ?? null,
        subtypeGroup: primary.supplyChainSubtypeGroup ?? null,
        subtype: primary.supplyChainSubtype ?? null,
        ...(preserveParent
          ? {}
          : { externalParentId: primary.parentCompanyId ?? null }),
        metadata: mergeCompanyMetadata(existing?.metadata, {
          mergedKeywords,
          mergedTags,
          mergedProducts,
          batchRows,
          now
        }),
        updatedAt: now
      },
      create: {
        id: randomUUID(),
        externalId,
        name: companyName,
        companyKey: primary.companyKey ?? null,
        website: primary.website ?? null,
        phone: primary.contactInfo?.phone ?? primary.phone ?? null,
        email: primary.contactInfo?.email ?? null,
        tier: primary.tier ?? null,
        segment: primary.segment ?? null,
        category: primary.supplyChainCategory ?? null,
        subtypeGroup: primary.supplyChainSubtypeGroup ?? null,
        subtype: primary.supplyChainSubtype ?? null,
        externalParentId: primary.parentCompanyId ?? null,
        metadata: mergeCompanyMetadata(null, {
          mergedKeywords,
          mergedTags,
          mergedProducts,
          batchRows,
          now
        }),
        createdAt: now,
        updatedAt: now
      }
    });

    companyMap.set(externalId, company.id);
    companiesCreated += 1;

    const dbParentId = preserveParent ? existing?.externalParentId?.trim() : undefined;
    const gptParentId = primary.parentCompanyId?.trim();
    const extParent = dbParentId || gptParentId;
    if (extParent) {
      parentMap.set(externalId, {
        externalParentId: extParent,
        parentCompany: primary.parentCompany ?? null,
        companyKey: primary.companyKey ?? null
      });
    }
  }

  let parentsLinked = 0;
  for (const [externalId, meta] of Array.from(parentMap.entries())) {
    const companyDbId = companyMap.get(externalId);
    if (!companyDbId) continue;

    if (companyIdsMatchedToMaster.has(externalId)) {
      const current = await prisma.company.findUnique({
        where: { id: companyDbId },
        select: { parentCompanyDbId: true }
      });
      if (current?.parentCompanyDbId) {
        continue;
      }
    }

    const resolved = await resolveParentCompanyDbId(prisma, {
      externalParentId: meta.externalParentId,
      parentCompany: meta.parentCompany,
      companyKey: meta.companyKey,
      childCompanyDbId: companyDbId
    });

    if (resolved) {
      await prisma.company.update({
        where: { id: companyDbId },
        data: {
          parentCompanyDbId: resolved.id,
          updatedAt: now
        }
      });
      parentsLinked++;
      if (resolved.via === 'companyKeyName') {
        console.warn(
          `[crm_import] Parent linked via companyKey+name (no Company.externalId match for ${meta.externalParentId}); cluster ${externalId}`
        );
      }
    }
  }

  const CHUNK = 250;
  let locationsCreated = 0;
  for (let i = 0; i < pairs.length; i += CHUNK) {
    const slice = pairs.slice(i, i + CHUNK);

    const tx = slice
      .filter((p) => p.eff.locationId && p.eff.companyId && p.eff.addressRaw)
      .map(async (pair) => {
        const supplier = pair.eff;
        const locationExternalId = supplier.locationId!;
        const companyExternalId = supplier.companyId!.trim();

        const companyDbId = companyMap.get(companyExternalId);
        if (!companyDbId) {
          console.warn(`Company not found for location ${locationExternalId}`);
          return null;
        }

        const multi = (clusterSizes.get(companyExternalId) ?? 1) > 1;
        const locationName =
          supplier.locationName?.trim() ||
          (multi ? supplier.company.trim() : null) ||
          null;

        const priorLoc = await prisma.location.findUnique({
          where: { externalId: locationExternalId },
          select: { legacyJson: true }
        });

        await prisma.location.upsert({
          where: { externalId: locationExternalId },
          update: {
            companyId: companyDbId,
            locationName: locationName ?? undefined,
            addressRaw: supplier.addressRaw || '',
            addressNormalized: null,
            addressComponents: addressComponentsInput(supplier.addressComponents),
            legacyJson: mergeLocationLegacyJson(priorLoc?.legacyJson, pair.orig, now),
            metadata: {
              _importedAt: now.toISOString(),
              _importSource: 'crm_import_v1'
            },
            updatedAt: now
          },
          create: {
            id: randomUUID(),
            externalId: locationExternalId,
            companyId: companyDbId,
            locationName: locationName ?? undefined,
            addressRaw: supplier.addressRaw || '',
            addressNormalized: null,
            addressComponents: addressComponentsInput(supplier.addressComponents),
            legacyJson: mergeLocationLegacyJson(null, pair.orig, now),
            metadata: {
              _importedAt: now.toISOString(),
              _importSource: 'crm_import_v1'
            },
            createdAt: now,
            updatedAt: now
          }
        });

        return true;
      });

    const results = await Promise.all(tx);
    locationsCreated += results.filter((r) => r !== null).length;
  }

  const locationExternalIdsTouched = Array.from(
    new Set(
      pairs
        .filter((p) => p.eff.locationId?.trim() && p.eff.addressRaw?.trim())
        .map((p) => p.eff.locationId!.trim())
    )
  );

  return {
    companiesCreated,
    companiesTotal: companyMap.size,
    parentsLinked,
    locationsCreated,
    rowsRemappedToDbMaster,
    locationExternalIdsTouched
  };
}
