import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Accept geocode from iOS: { latitude, longitude, addressNormalized?, accuracy?, meta? }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const b = await req.json();

    // allow string or number
    const lat = b.latitude ?? b.lat ?? null;
    const lon = b.longitude ?? b.lng ?? b.lon ?? null;

    const data: any = {};
    if (lat != null) data.latitude = String(lat);
    if (lon != null) data.longitude = String(lon);
    if (b.addressNormalized != null) data.addressNormalized = String(b.addressNormalized);

    // stamp provider metadata if any geocode fields present
    if (lat != null || lon != null || b.addressNormalized != null) {
      data.geocodeStatus   = "geocoded";
      data.geocodeProvider = "ios-clgeocoder";
      if (b.accuracy != null) data.geocodeAccuracy = String(b.accuracy); // e.g. "rooftop"/"approx"
      if (b.meta != null)     data.geocodeMeta     = b.meta;             // raw CLPlacemark bits if you send them
      data.geocodedAt = new Date();
      data.geocodeLastError = null;
      data.geocodeAttempts  = 0;
    }

    // optional safe passthroughs (won't hurt if absent)
    for (const k of ["company","parentCompany","website","phone","category","segment","addressRaw","notes","accountState","tier","focus"])
      if (b[k] != null) data[k] = b[k];

    const updated = await prisma.target.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Update failed" }, { status: 500 });
  }
}
