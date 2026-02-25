export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

type SupplierJson = {
  company: string;
  website?: string | null;
  phone?: string | null;
  addressRaw?: string;
  addressComponents?: any;
  tier?: string | null;
  supplyChainCategory?: string | null;
  supplyChainSubtype?: string | null;
  segment?: string | null;
  companyId?: string | null;
  locationId?: string | null;
  companyKey?: string | null;
  parentCompanyId?: string | null;
  industryKeywords?: string[] | null;
  capabilityTags?: string[] | null;
  keyProducts?: string[] | null;
  contactInfo?: {
    phone?: string | null;
    email?: string | null;
  } | null;
};

export const runtime = "nodejs";

// CSV columns: companyId, locationId, company, website, phone, addressRaw, city, state, postalCode, country, tier, supplyChainCategory, supplyChainSubtype, companyKey, parentCompanyId, segment, keyProducts
function parseCSVToSuppliers(csvText: string): SupplierJson[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const get = (row: string[], name: string) => {
    const i = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    return i >= 0 ? (row[i] ?? "").trim() || undefined : undefined;
  };

  const suppliers: SupplierJson[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const keyProductsRaw = get(values, "keyProducts");
    const keyProducts = keyProductsRaw
      ? keyProductsRaw.split(/[|,]/).map((s) => s.trim()).filter(Boolean)
      : undefined;

    suppliers.push({
      companyId: get(values, "companyId") || undefined,
      locationId: get(values, "locationId") || undefined,
      company: get(values, "company") ?? "",
      website: get(values, "website") || undefined,
      phone: get(values, "phone") || undefined,
      addressRaw: get(values, "addressRaw") || undefined,
      tier: get(values, "tier") || undefined,
      supplyChainCategory: get(values, "supplyChainCategory") || undefined,
      supplyChainSubtype: get(values, "supplyChainSubtype") || undefined,
      companyKey: get(values, "companyKey") || undefined,
      parentCompanyId: get(values, "parentCompanyId") || undefined,
      segment: get(values, "segment") || undefined,
      keyProducts: keyProducts?.length ? keyProducts : undefined,
      contactInfo:
        get(values, "phone") || get(values, "email")
          ? { phone: get(values, "phone") ?? null, email: get(values, "email") ?? null }
          : undefined,
      addressComponents:
        get(values, "city") || get(values, "state") || get(values, "postalCode") || get(values, "country")
          ? {
              city: get(values, "city"),
              state: get(values, "state"),
              postalCode: get(values, "postalCode"),
              country: get(values, "country"),
            }
          : undefined,
    });
  }
  return suppliers;
}

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      cur += c;
    } else if (c === ",") {
      out.push(cur.trim().replace(/^"|"$/g, ""));
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim().replace(/^"|"$/g, ""));
  return out;
}

export async function POST(req: Request) {
  try {
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    let suppliers: SupplierJson[];

    if (contentType.includes("text/csv")) {
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
        { error: "Provide JSON array, { suppliers: [...] }, or CSV (Content-Type: text/csv) with columns: companyId, locationId, company, website, phone, addressRaw, city, state, postalCode, country, tier, supplyChainCategory, supplyChainSubtype, companyKey, parentCompanyId, segment, keyProducts" },
        { status: 400 }
      );
    }

    const now = new Date();
    const companyMap = new Map<string, string>(); // externalId -> dbId
    const parentMap = new Map<string, string>(); // companyExternalId -> parentExternalId

    // PASS 1: Create Companies (without parent relationships)
    let companiesCreated = 0;
    const CHUNK = 250;

    for (let i = 0; i < suppliers.length; i += CHUNK) {
      const slice = suppliers.slice(i, i + CHUNK);
      
      const tx = slice
        .filter(s => s.companyId && s.company?.trim())
        .map(async (supplier) => {
          const externalId = supplier.companyId!;
          
          // Clean company name - remove 'x' prefix if it's a UUID pattern
          let companyName = supplier.company.trim();
          const uuidPattern = /^x[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$/;
          if (uuidPattern.test(companyName)) {
            companyName = companyName.substring(1); // Remove 'x' prefix
          }
          
          // Upsert company (create or update)
          const company = await prisma.company.upsert({
            where: { externalId },
            update: {
              name: companyName,
              companyKey: supplier.companyKey ?? null,
              website: supplier.website ?? null,
              phone: supplier.contactInfo?.phone ?? null,
              email: supplier.contactInfo?.email ?? null,
              tier: supplier.tier ?? null,
              segment: supplier.segment ?? null,
              category: supplier.supplyChainCategory ?? null,
              subtype: supplier.supplyChainSubtype ?? null,
              externalParentId: supplier.parentCompanyId ?? null,
              metadata: {
                ...(supplier.industryKeywords ? { industryKeywords: supplier.industryKeywords } : {}),
                ...(supplier.capabilityTags ? { capabilityTags: supplier.capabilityTags } : {}),
                ...(supplier.keyProducts ? { keyProducts: supplier.keyProducts } : {}),
                _importedAt: now.toISOString(),
                _importSource: "crm_import_v1"
              },
              updatedAt: now,
            },
            create: {
              id: randomUUID(),
              externalId,
              name: companyName,
              companyKey: supplier.companyKey ?? null,
              website: supplier.website ?? null,
              phone: supplier.contactInfo?.phone ?? null,
              email: supplier.contactInfo?.email ?? null,
              tier: supplier.tier ?? null,
              segment: supplier.segment ?? null,
              category: supplier.supplyChainCategory ?? null,
              subtype: supplier.supplyChainSubtype ?? null,
              externalParentId: supplier.parentCompanyId ?? null,
              metadata: {
                ...(supplier.industryKeywords ? { industryKeywords: supplier.industryKeywords } : {}),
                ...(supplier.capabilityTags ? { capabilityTags: supplier.capabilityTags } : {}),
                ...(supplier.keyProducts ? { keyProducts: supplier.keyProducts } : {}),
                _importedAt: now.toISOString(),
                _importSource: "crm_import_v1"
              },
              createdAt: now,
              updatedAt: now,
            },
          });

          companyMap.set(externalId, company.id);
          
          // Track parent relationships for pass 2
          if (supplier.parentCompanyId) {
            parentMap.set(externalId, supplier.parentCompanyId);
          }

          return company.id; // Return ID to count new vs updated
        });

      const results = await Promise.all(tx);
      companiesCreated += results.filter(r => r !== null).length;
    }

    // PASS 2: Link Parent Companies
    let parentsLinked = 0;
    for (const [externalId, externalParentId] of Array.from(parentMap.entries())) {
      const companyDbId = companyMap.get(externalId);
      if (!companyDbId) continue;

      // Find parent by externalId
      const parent = await prisma.company.findUnique({
        where: { externalId: externalParentId },
      });

      if (parent) {
        await prisma.company.update({
          where: { id: companyDbId },
          data: { 
            parentCompanyDbId: parent.id,
            updatedAt: now,
          },
        });
        parentsLinked++;
      }
    }

    // PASS 3: Create Locations
    let locationsCreated = 0;
    for (let i = 0; i < suppliers.length; i += CHUNK) {
      const slice = suppliers.slice(i, i + CHUNK);
      
      const tx = slice
        .filter(s => s.locationId && s.companyId && s.addressRaw)
        .map(async (supplier) => {
          const locationExternalId = supplier.locationId!;
          const companyExternalId = supplier.companyId!;

          const companyDbId = companyMap.get(companyExternalId);
          if (!companyDbId) {
            console.warn(`Company not found for location ${locationExternalId}`);
            return null;
          }

          // Upsert location (create or update)
          const location = await prisma.location.upsert({
            where: { externalId: locationExternalId },
            update: {
              companyId: companyDbId,
              addressRaw: supplier.addressRaw || '',
              addressNormalized: null,
              addressComponents: supplier.addressComponents ?? null,
              metadata: {
                _importedAt: now.toISOString(),
                _importSource: "crm_import_v1"
              },
              updatedAt: now,
            },
            create: {
              id: randomUUID(),
              externalId: locationExternalId,
              companyId: companyDbId,
              addressRaw: supplier.addressRaw || '',
              addressNormalized: null,
              addressComponents: supplier.addressComponents ?? null,
              metadata: {
                _importedAt: now.toISOString(),
                _importSource: "crm_import_v1"
              },
              createdAt: now,
              updatedAt: now,
            },
          });

          return location;
        });

      const results = await Promise.all(tx);
      locationsCreated += results.filter(r => r !== null).length;
    }

    return NextResponse.json({
      ok: true,
      companiesCreated,
      companiesTotal: companyMap.size,
      parentsLinked,
      locationsCreated,
    });
  } catch (e: any) {
    console.error("Import error:", e);
    return NextResponse.json(
      { error: e?.message ?? "import failed" },
      { status: 500 }
    );
  }
}
