export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runCrmSupplierImport, type CrmSupplierJson } from '@/lib/crm-supplier-import';
import { runGeocodeBulkQueue } from '@/lib/geocode-bulk-queue';

export const runtime = 'nodejs';

// CSV columns: companyId, locationId, company, website, phone, addressRaw, city, state, postalCode, country, tier, supplyChainCategory, supplyChainSubtype, supplyChainSubtypeGroup, companyKey, parentCompanyId, segment, keyProducts
function parseCSVToSuppliers(csvText: string): CrmSupplierJson[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const get = (row: string[], name: string) => {
    const i = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    return i >= 0 ? (row[i] ?? '').trim() || undefined : undefined;
  };

  const suppliers: CrmSupplierJson[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const keyProductsRaw = get(values, 'keyProducts');
    const keyProducts = keyProductsRaw
      ? keyProductsRaw.split(/[|,]/).map((s) => s.trim()).filter(Boolean)
      : undefined;

    suppliers.push({
      companyId: get(values, 'companyId') || undefined,
      locationId: get(values, 'locationId') || undefined,
      company: get(values, 'company') ?? '',
      website: get(values, 'website') || undefined,
      phone: get(values, 'phone') || undefined,
      addressRaw: get(values, 'addressRaw') || undefined,
      tier: get(values, 'tier') || undefined,
      supplyChainCategory: get(values, 'supplyChainCategory') || undefined,
      supplyChainSubtypeGroup: get(values, 'supplyChainSubtypeGroup') || undefined,
      supplyChainSubtype: get(values, 'supplyChainSubtype') || undefined,
      companyKey: get(values, 'companyKey') || undefined,
      parentCompanyId: get(values, 'parentCompanyId') || undefined,
      segment: get(values, 'segment') || undefined,
      keyProducts: keyProducts?.length ? keyProducts : undefined,
      contactInfo:
        get(values, 'phone') || get(values, 'email')
          ? { phone: get(values, 'phone') ?? null, email: get(values, 'email') ?? null }
          : undefined,
      addressComponents:
        get(values, 'city') || get(values, 'state') || get(values, 'postalCode') || get(values, 'country')
          ? {
              city: get(values, 'city'),
              state: get(values, 'state'),
              postalCode: get(values, 'postalCode'),
              country: get(values, 'country')
            }
          : undefined
    });
  }
  return suppliers;
}

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      cur += c;
    } else if (c === ',') {
      out.push(cur.trim().replace(/^"|"$/g, ''));
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur.trim().replace(/^"|"$/g, ''));
  return out;
}

export async function POST(req: Request) {
  try {
    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    let suppliers: CrmSupplierJson[];

    if (contentType.includes('text/csv')) {
      const csvText = await req.text();
      suppliers = parseCSVToSuppliers(csvText);
    } else {
      const body = await req.json().catch(() => null);
      suppliers = Array.isArray(body)
        ? body
        : Array.isArray(body?.suppliers)
          ? body.suppliers
          : [];
    }

    if (!suppliers.length) {
      return NextResponse.json(
        {
          error:
            'Provide JSON array, { suppliers: [...] }, or CSV (Content-Type: text/csv) with columns: companyId, locationId, company, website, phone, addressRaw, city, state, postalCode, country, tier, supplyChainCategory, supplyChainSubtype, supplyChainSubtypeGroup, companyKey, parentCompanyId, segment, keyProducts'
        },
        { status: 400 }
      );
    }

    const result = await runCrmSupplierImport(prisma, suppliers);

    const geocode = await runGeocodeBulkQueue(prisma, {
      locationExternalIds:
        result.locationExternalIdsTouched.length > 0
          ? result.locationExternalIdsTouched
          : undefined
    });

    return NextResponse.json({
      ok: true,
      companiesCreated: result.companiesCreated,
      companiesTotal: result.companiesTotal,
      parentsLinked: result.parentsLinked,
      locationsCreated: result.locationsCreated,
      rowsRemappedToDbMaster: result.rowsRemappedToDbMaster,
      geocode
    });
  } catch (e: unknown) {
    console.error('Import error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'import failed' },
      { status: 500 }
    );
  }
}
