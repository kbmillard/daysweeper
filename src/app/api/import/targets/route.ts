export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Accepts JSON array or { items: [...] } of rows like:
// { company, addressRaw, website?, phone?, email?, companyId?, locationId?, parentCompanyId?,
//   segment?, tier?, supplyChainCategory?, supplyChainSubtypeGroup?, supplyChainSubtype?,
//   capabilityTags?[], packagingSignals?[], addressComponents?, legacyJson?, companyKey? }

type Row = {
  company: string;
  addressRaw?: string;
  website?: string | null;
  phone?: string | null;
  email?: string | null;

  companyId?: string | null;
  locationId?: string | null;
  parentCompanyId?: string | null;

  segment?: string | null;
  tier?: string | null;
  supplyChainCategory?: string | null;
  supplyChainSubtypeGroup?: string | null;
  supplyChainSubtype?: string | null;

  capabilityTags?: string[] | null;
  packagingSignals?: string[] | null;

  addressComponents?: any;

  legacyJson?: any;
  companyKey?: string | null;
  externalId?: string | null; // optional, if present prefer this
};

const idFor = (r: Row) => {
  if (r.externalId) return r.externalId;
  if (r.locationId) return r.locationId!;
  if (r.companyId) return `cmp_${r.companyId}`;
  const basis = `${(r.company||"").trim()}|${r.addressRaw||""}`;
  return Buffer.from(basis).toString("base64").replace(/=+$/,"").slice(0,24);
};

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(()=>null);
    const rows: Row[] = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [];
    if (!rows.length) {
      return NextResponse.json({ error: "Provide JSON array or {items:[...]}" }, { status: 400 });
    }

    // Chunk to avoid param explosion
    let upserted = 0;
    const CHUNK = 250;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK).filter(r => (r.company||"").trim().length > 0);

      const tx = slice.map((r) => {
        const id = idFor(r);
        const now = new Date();
        const data: any = {
          company: String(r.company).trim(),
          addressRaw: String(r.addressRaw ?? ""),
          website: r.website ?? null,
          phone: r.phone ?? null,
          email: r.email ?? null,
          geocodeStatus: "missing",
          updatedAt: now,
          geocodeMeta: {
            ...(r.legacyJson ? { legacyJson: r.legacyJson } : {}),
            ...(r.addressComponents ? { addressComponents: r.addressComponents } : {}),
            ...(r.companyKey ? { companyKey: r.companyKey } : {}),
            ...(r.segment ? { segment: r.segment } : {}),
            ...(r.tier ? { tier: r.tier } : {}),
            ...(r.supplyChainCategory ? { supplyChainCategory: r.supplyChainCategory } : {}),
            ...(r.supplyChainSubtypeGroup ? { supplyChainSubtypeGroup: r.supplyChainSubtypeGroup } : {}),
            ...(r.supplyChainSubtype ? { supplyChainSubtype: r.supplyChainSubtype } : {}),
            ...(r.capabilityTags ? { capabilityTags: r.capabilityTags } : {}),
            ...(r.packagingSignals ? { packagingSignals: r.packagingSignals } : {}),
            ...(r.companyId ? { companyId: r.companyId } : {}),
            ...(r.locationId ? { locationId: r.locationId } : {}),
            ...(r.parentCompanyId ? { parentCompanyId: r.parentCompanyId } : {}),
            _importedAt: new Date().toISOString(),
            _importSource: "json_import_v1"
          }
        };

        return prisma.target.upsert({
          where: { id } as any,
          update: data,
          create: { id, ...data }
        });
      });

      const res = await prisma.$transaction(tx);
      upserted += res.length;
    }

    return NextResponse.json({ ok: true, upserted });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message ?? "import failed" }, { status: 500 });
  }
}
