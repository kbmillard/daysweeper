import { randomUUID } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { IMPORT_GEOCODE_DEFERRED } from '@/lib/geocode-import-deferred';

function slugPart(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
}

function buildAddressRaw(parts: (string | null | undefined)[]): string {
  return parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join(', ');
}

/** Shape A: SC-style `vendors` + `category`. */
type VendorRowA = {
  company: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  website?: string | null;
  role?: string | null;
  notes?: string | null;
};

/** Shape B: GA-style with `vendor_id`, `company_name`, etc. */
type VendorRowB = {
  vendor_id: string;
  company_name: string;
  role?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  primary_phone?: string | null;
  website_url?: string | null;
  product_notes?: string | null;
  brands_or_product_lines?: unknown;
  verification_notes?: string | null;
  sources?: unknown;
};

/** Shape C: nested `companies` + `locations` (e.g. KY batch with `KY-001-L1` ids). */
type VendorCompanyNested = {
  company_id?: string;
  company_name: string;
  role?: string | null;
  website_url?: string | null;
  product_keywords?: unknown;
  evidence_summary?: string | null;
  locations?: unknown;
  sources?: unknown;
  states_covered?: string[];
  alternate_name?: string | null;
  parent_company_name?: string | null;
  relationship_notes?: unknown;
};

type VendorLocationNested = {
  location_id: string;
  location_type?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
};

export type BuyerVendorImportPayload =
  | {
      vendor_count?: number;
      category?: string;
      vendors?: VendorRowA[];
    }
  | {
      vendor_count?: number;
      vendors?: VendorRowB[];
      generated_at_local?: string;
      coverage_notes?: unknown;
    }
  | {
      category?: string;
      companies?: VendorCompanyNested[];
      generated_at?: string;
      state?: string;
      [key: string]: unknown;
    };

export type SellerImportPayload = BuyerVendorImportPayload;

function buyerLocationExternalId(companyExternalId: string): string {
  return `${companyExternalId}__buyer_loc`;
}

function normalizeRows(body: BuyerVendorImportPayload): {
  externalId: string;
  name: string;
  addressRaw: string;
  phone: string | null;
  website: string | null;
  role: string | null;
  notes: string | null;
  importCategory: string | null;
  legacyJson: Prisma.InputJsonValue;
}[] {
  const out: ReturnType<typeof normalizeRows> = [];

  if (Array.isArray((body as { vendors?: unknown }).vendors)) {
    const vendors = (body as { vendors: unknown[] }).vendors;
    const category =
      'category' in body && typeof body.category === 'string' ? body.category.trim() : null;

    for (let i = 0; i < vendors.length; i++) {
      const v = vendors[i];
      if (!v || typeof v !== 'object') continue;

      if ('vendor_id' in v && typeof (v as VendorRowB).vendor_id === 'string') {
        const row = v as VendorRowB;
        const ext = `vendor_${row.vendor_id.trim()}`;
        const street = row.street_address?.trim();
        const isBadStreet =
          !street ||
          /^unspecified$/i.test(street) ||
          /^po\s*box/i.test(street);
        const addr = buildAddressRaw([
          isBadStreet ? null : street,
          row.city,
          row.state,
          row.zip
        ]);
        const notes = [row.product_notes, row.verification_notes]
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          .join('\n\n');
        const brands = Array.isArray(row.brands_or_product_lines)
          ? row.brands_or_product_lines.filter((x): x is string => typeof x === 'string')
          : [];
        const web = row.website_url?.trim();
        out.push({
          externalId: ext,
          name: row.company_name.trim(),
          addressRaw: addr || buildAddressRaw([row.city, row.state, row.zip]),
          phone: row.primary_phone?.trim() || null,
          website: web && !/^unspecified$/i.test(web) ? web : null,
          role: row.role?.trim() || null,
          notes: notes || null,
          importCategory: category,
          legacyJson: {
            ...row,
            brands_or_product_lines: brands,
            _importShape: 'vendor_id'
          } as unknown as Prisma.InputJsonValue
        });
        continue;
      }

      if ('company' in v && typeof (v as VendorRowA).company === 'string') {
        const row = v as VendorRowA;
        const name = row.company.trim();
        if (!name) continue;
        const zip = row.zip?.trim() || 'x';
        const city = row.city?.trim() || 'x';
        const ext = category
          ? `sel_${slugPart(category)}_${slugPart(name)}_${slugPart(city)}_${slugPart(zip)}`
          : `sel_${slugPart(name)}_${slugPart(city)}_${i}`;
        const addr = buildAddressRaw([row.address, row.city, row.state, row.zip]);
        out.push({
          externalId: ext,
          name,
          addressRaw: addr || buildAddressRaw([row.city, row.state, row.zip]),
          phone: row.phone?.trim() || null,
          website: row.website?.trim() || null,
          role: row.role?.trim() || null,
          notes: row.notes?.trim() || null,
          importCategory: category,
          legacyJson: { ...row, _importShape: 'company_city' } as unknown as Prisma.InputJsonValue
        });
      }
    }
  }

  if (Array.isArray((body as { companies?: unknown }).companies)) {
    const companies = (body as { companies: unknown[] }).companies;
    const category =
      'category' in body && typeof body.category === 'string' ? body.category.trim() : null;

    for (const c of companies) {
      if (!c || typeof c !== 'object') continue;
      const co = c as VendorCompanyNested;
      const name = co.company_name?.trim();
      if (!name) continue;

      const kw = Array.isArray(co.product_keywords)
        ? co.product_keywords.filter((x): x is string => typeof x === 'string')
        : [];
      const locs = Array.isArray(co.locations) ? co.locations : [];

      for (const rawLoc of locs) {
        if (!rawLoc || typeof rawLoc !== 'object') continue;
        const loc = rawLoc as VendorLocationNested;
        const lid = typeof loc.location_id === 'string' ? loc.location_id.trim() : '';
        if (!lid) continue;

        const ext = `vendor_${lid}`;
        const street = loc.street_address?.trim();
        const isBadStreet =
          !street ||
          /^unspecified$/i.test(street) ||
          /^po\s*box/i.test(street);
        const addr = buildAddressRaw([
          isBadStreet ? null : street,
          loc.city,
          loc.state,
          loc.zip
        ]);
        const locType = loc.location_type?.trim();
        const evidence = co.evidence_summary?.trim();
        const notes = [evidence, locType ? `Location type: ${locType}` : null]
          .filter((x): x is string => Boolean(x && x.length))
          .join('\n\n');
        const web = co.website_url?.trim();
        const alt = co.alternate_name?.trim();
        const states = co.states_covered;
        const parentCo = co.parent_company_name?.trim();
        const relNotes = Array.isArray(co.relationship_notes)
          ? co.relationship_notes.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          : [];
        out.push({
          externalId: ext,
          name,
          addressRaw: addr || buildAddressRaw([loc.city, loc.state, loc.zip]),
          phone: loc.phone?.trim() || null,
          website: web && !/^unspecified$/i.test(web) ? web : null,
          role: co.role?.trim() || null,
          notes: notes || null,
          importCategory: category,
          legacyJson: {
            _importShape: 'company_locations',
            company_id: co.company_id ?? null,
            company_name: name,
            location_id: lid,
            location: loc,
            product_keywords: kw,
            evidence_summary: evidence ?? null,
            sources: co.sources ?? null,
            role: co.role ?? null,
            ...(Array.isArray(states) && states.length ? { states_covered: states } : {}),
            ...(alt ? { alternate_name: alt } : {}),
            ...(parentCo ? { parent_company_name: parentCo } : {}),
            ...(relNotes.length ? { relationship_notes: relNotes } : {})
          } as unknown as Prisma.InputJsonValue
        });
      }
    }
  }

  return out;
}

export type BuyerVendorImportResult = {
  upserted: number;
  locationExternalIdsTouched: string[];
  geocode:
    | { success: number; failed: number }
    | typeof IMPORT_GEOCODE_DEFERRED;
};

function mergeSellerMetadata(
  existing: unknown,
  patch: { role: string | null; notes: string | null; importCategory: string | null }
): Prisma.InputJsonValue {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const prev =
    (base.sellerImport as Record<string, unknown>) ||
    (base.buyerImport as Record<string, unknown>) ||
    {};
  base.sellerImport = {
    ...prev,
    ...Object.fromEntries(
      Object.entries({
        role: patch.role,
        notes: patch.notes,
        importCategory: patch.importCategory
      }).filter(([, v]) => v != null && String(v).trim() !== '')
    )
  };
  return base as Prisma.InputJsonValue;
}

/**
 * Upsert companies marked as sellers (competitors / vendor research) + primary location row.
 * Geocodes new/changed locations via the same bulk queue as CRM imports.
 */
export async function runSellerVendorImport(
  prisma: PrismaClient,
  body: BuyerVendorImportPayload
): Promise<BuyerVendorImportResult> {
  const rows = normalizeRows(body);
  if (rows.length === 0) {
    return { upserted: 0, locationExternalIdsTouched: [], geocode: { success: 0, failed: 0 } };
  }

  const now = new Date();
  let upserted = 0;
  const locationExternalIdsTouched: string[] = [];

  for (const r of rows) {
    const locExt = buyerLocationExternalId(r.externalId);

    const existing = await prisma.company.findUnique({
      where: { externalId: r.externalId },
      select: { id: true, metadata: true }
    });

    const company = await prisma.company.upsert({
      where: { externalId: r.externalId },
      create: {
        id: randomUUID(),
        externalId: r.externalId,
        name: r.name,
        phone: r.phone,
        website: r.website,
        hidden: false,
        isSeller: true,
        legacyJson: r.legacyJson,
        metadata: mergeSellerMetadata(null, {
          role: r.role,
          notes: r.notes,
          importCategory: r.importCategory
        }),
        createdAt: now,
        updatedAt: now
      },
      update: {
        name: r.name,
        phone: r.phone,
        website: r.website,
        isSeller: true,
        legacyJson: r.legacyJson,
        metadata: mergeSellerMetadata(existing?.metadata ?? null, {
          role: r.role,
          notes: r.notes,
          importCategory: r.importCategory
        }),
        updatedAt: now
      }
    });

    await prisma.location.upsert({
      where: { externalId: locExt },
      create: {
        id: randomUUID(),
        companyId: company.id,
        externalId: locExt,
        addressRaw: r.addressRaw || '',
        updatedAt: now
      },
      update: {
        companyId: company.id,
        addressRaw: r.addressRaw || '',
        updatedAt: now
      }
    });

    const sellerLoc = await prisma.location.findFirst({
      where: { externalId: locExt, companyId: company.id },
      select: { id: true }
    });
    if (sellerLoc) {
      const prim = await prisma.company.findUnique({
        where: { id: company.id },
        select: { primaryLocationId: true }
      });
      if (!prim?.primaryLocationId) {
        await prisma.company.update({
          where: { id: company.id },
          data: { primaryLocationId: sellerLoc.id, updatedAt: now }
        });
      }
    }

    locationExternalIdsTouched.push(locExt);
    upserted++;
  }

  return { upserted, locationExternalIdsTouched, geocode: IMPORT_GEOCODE_DEFERRED };
}

export function isSellerVendorImportBody(body: unknown): body is BuyerVendorImportPayload {
  if (!body || typeof body !== 'object') return false;
  const o = body as { vendors?: unknown; companies?: unknown };
  return Array.isArray(o.vendors) || Array.isArray(o.companies);
}

/** @deprecated Use `isSellerVendorImportBody` */
export const isBuyerVendorImportBody = isSellerVendorImportBody;

/** @deprecated Use `runSellerVendorImport` */
export const runBuyerVendorImport = runSellerVendorImport;
