import { randomUUID } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { runSellerGeocodeQueue } from '@/lib/seller-geocode-queue';

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

export type SellerImportPayload = {
  vendor_count?: number;
  category?: string;
  vendors?: VendorRowA[];
} | {
  vendor_count?: number;
  vendors?: VendorRowB[];
  generated_at_local?: string;
  coverage_notes?: unknown;
};

function normalizeRows(body: SellerImportPayload): {
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
          legacyJson: { ...row, brands_or_product_lines: brands, _importShape: 'vendor_id' } as unknown as Prisma.InputJsonValue
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

  return out;
}

export type SellerImportResult = {
  upserted: number;
  sellerExternalIdsTouched: string[];
  geocode: { success: number; failed: number };
};

export async function runSellerImport(
  prisma: PrismaClient,
  body: SellerImportPayload
): Promise<SellerImportResult> {
  const rows = normalizeRows(body);
  if (rows.length === 0) {
    return { upserted: 0, sellerExternalIdsTouched: [], geocode: { success: 0, failed: 0 } };
  }

  const now = new Date();
  let upserted = 0;

  for (const r of rows) {
    await prisma.seller.upsert({
      where: { externalId: r.externalId },
      create: {
        id: randomUUID(),
        externalId: r.externalId,
        name: r.name,
        addressRaw: r.addressRaw,
        addressNormalized: null,
        phone: r.phone,
        website: r.website,
        role: r.role,
        notes: r.notes,
        importCategory: r.importCategory,
        legacyJson: r.legacyJson,
        createdAt: now,
        updatedAt: now
      },
      update: {
        name: r.name,
        addressRaw: r.addressRaw,
        addressNormalized: null,
        phone: r.phone,
        website: r.website,
        role: r.role,
        notes: r.notes,
        importCategory: r.importCategory,
        legacyJson: r.legacyJson,
        updatedAt: now
      }
    });
    upserted++;
  }

  const sellerExternalIdsTouched = rows.map((r) => r.externalId);
  const geocode = await runSellerGeocodeQueue(prisma, {
    externalIds: sellerExternalIdsTouched
  });

  return { upserted, sellerExternalIdsTouched, geocode };
}
