import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Row = {
  company: string;
  addressRaw?: string;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  accountState?: string | null;
  supplyTier?: string | null;
  supplyGroup?: string | null;
  supplySubtype?: string | null;
  externalId?: string | null; // optional if you have it
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rows: Row[] = Array.isArray(body) ? body : body?.items;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'Provide JSON array of targets or {items:[...]}' },
        { status: 400 }
      );
    }

    // Prefer upsert by externalId if provided, else fallback to company+addressRaw (weak)
    const tx = rows
      .map((r) => {
        const company = String(r.company ?? '').trim();
        if (!company) return null;
        const data = {
          company,
          addressRaw: String(r.addressRaw ?? ''),
          website: r.website ?? null,
          phone: r.phone ?? null,
          email: r.email ?? null,
          accountState: (r.accountState as any) ?? 'NEW_UNCONTACTED',
          supplyTier: r.supplyTier ?? null,
          supplyGroup: r.supplyGroup ?? null,
          supplySubtype: r.supplySubtype ?? null
        };
        if (r.externalId) {
          return prisma.target.upsert({
            where: { id: r.externalId as any }, // adjust if you store externalId in a dedicated column
            update: data,
            create: { ...data, id: r.externalId as any }
          });
        } else {
          const syntheticId = Buffer.from(`${data.company}|${data.addressRaw}`)
            .toString('base64')
            .slice(0, 24);
          return prisma.target.upsert({
            where: { id: syntheticId } as any,
            update: data,
            create: { ...data, id: syntheticId } as any
          });
        }
      })
      .filter(Boolean) as any[];

    const out = await prisma.$transaction(tx);
    return NextResponse.json({ ok: true, count: out.length });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'import failed' },
      { status: 500 }
    );
  }
}
