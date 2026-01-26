import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const target = await prisma.target.findUnique({
      where: { id },
      include: {
        TargetNote: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!target) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    return NextResponse.json(target);
  } catch (error) {
    console.error('Get target error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch target' },
      { status: 500 }
    );
  }
}

// PATCH /api/targets/:id
// iOS sends { latitude, longitude, addressNormalized?, accuracy?, meta? }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const b = await req.json();

    const lat = b.latitude ?? b.lat ?? null;
    const lon = b.longitude ?? b.lng ?? b.lon ?? null;

    const data: any = {};
    if (lat != null) data.latitude = String(lat);
    if (lon != null) data.longitude = String(lon);
    if (b.addressNormalized != null) data.addressNormalized = String(b.addressNormalized);

    if (lat != null || lon != null || b.addressNormalized != null) {
      data.geocodeStatus   = "geocoded";
      data.geocodeProvider = "ios-clgeocoder";
      if (b.accuracy != null) data.geocodeAccuracy = String(b.accuracy);
      if (b.meta != null)     data.geocodeMeta     = b.meta;
      data.geocodedAt = new Date();
      data.geocodeLastError = null;
      data.geocodeAttempts  = 0;
    }

    // Optional safe passthroughs; ignore if not present
    for (const k of ["company","parentCompany","website","phone","category","segment","addressRaw","notes","accountState","tier","focus"])
      if (b[k] != null) data[k] = b[k];

    const updated = await prisma.target.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.target.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Delete failed" }, { status: 500 });
  }
}
