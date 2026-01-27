import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type T = {
  company: string;
  addressRaw?: string;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  accountState?: 'ACCOUNT' | 'NEW_UNCONTACTED' | 'NEW_CONTACTED_NO_ANSWER';
  supplyTier?: string | null;
  supplyGroup?: string | null;
  supplySubtype?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rows: T[] = Array.isArray(body) ? body : body?.items;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'Provide JSON array of targets or {items: [...]}' },
        { status: 400 }
      );
    }
    const toCreate = rows
      .map((r) => ({
        company: String(r.company ?? '').trim(),
        addressRaw: String(r.addressRaw ?? ''),
        website: r.website ?? null,
        phone: r.phone ?? null,
        email: r.email ?? null,
        accountState: (r.accountState as any) ?? 'NEW_UNCONTACTED',
        supplyTier: r.supplyTier ?? null,
        supplyGroup: r.supplyGroup ?? null,
        supplySubtype: r.supplySubtype ?? null
      }))
      .filter((x) => x.company.length > 0);

    // Use skipDuplicates to avoid errors on re-imports
    // Note: For true deduplication by (company, addressRaw), add a unique constraint in schema
    const created = await prisma.target.createMany({
      data: toCreate as any,
      skipDuplicates: true
    });
    return NextResponse.json({
      ok: true,
      created: created.count,
      skipped: toCreate.length - created.count
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'import failed' },
      { status: 500 }
    );
  }
}
