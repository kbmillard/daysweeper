import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

type SupplierJson = {
  company: string;
  website?: string | null;
  addressRaw?: string;
  addressComponents?: any;
  addressConfidence?: number | null;
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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const suppliers: SupplierJson[] = Array.isArray(body) 
      ? body 
      : Array.isArray(body?.suppliers) 
        ? body.suppliers 
        : [];
    
    if (!suppliers.length) {
      return NextResponse.json(
        { error: "Provide JSON array or {suppliers:[...]}" },
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
          
          // Check if company already exists
          const existing = await prisma.company.findUnique({
            where: { externalId },
          });

          if (existing) {
            companyMap.set(externalId, existing.id);
            return null;
          }

          // Create new company
          const company = await prisma.company.create({
            data: {
              id: randomUUID(),
              externalId,
              name: supplier.company.trim(),
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

          return company;
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

          // Check if location already exists
          const existing = await prisma.location.findUnique({
            where: { externalId: locationExternalId },
          });

          if (existing) {
            return null;
          }

          const companyDbId = companyMap.get(companyExternalId);
          if (!companyDbId) {
            console.warn(`Company not found for location ${locationExternalId}`);
            return null;
          }

          // Create location
          const location = await prisma.location.create({
            data: {
              id: randomUUID(),
              externalId: locationExternalId,
              companyId: companyDbId,
              addressRaw: supplier.addressRaw || '',
              addressNormalized: null,
              addressComponents: supplier.addressComponents ?? null,
              addressConfidence: supplier.addressConfidence ?? null,
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
