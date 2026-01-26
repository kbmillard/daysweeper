import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = await prisma.target.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const q = target.addressRaw || target.company;
  if (!q) return NextResponse.json({ error: "No address/company to geocode" }, { status: 400 });

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return NextResponse.json({ error: "Mapbox token missing" }, { status: 500 });

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&limit=1`;
  const r = await fetch(url);
  if (!r.ok) return NextResponse.json({ error: "Geocode failed" }, { status: 502 });
  const j = await r.json();
  const first = j.features?.[0];
  if (!first) return NextResponse.json({ error: "No result" }, { status: 404 });

  const [lon, lat] = first.center;
  const updated = await prisma.target.update({
    where: { id },
    data: { latitude: String(lat), longitude: String(lon) },
  });
  return NextResponse.json({ ok: true, target: updated });
}
