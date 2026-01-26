import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const R = 6371000; // meters

function toNum(n: any) { const v = Number(n); return Number.isFinite(v) ? v : null; }
function haversine(lat1:number, lon1:number, lat2:number, lon2:number) {
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * GET /api/geo/drift-check?since=2025-01-01&threshold=150
 * Returns targets geocoded since 'since' where new coords differ from stored 'latitude/longitude'
 * (If you keep historic values elsewhere, adapt accordingly.)
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const since = u.searchParams.get("since");
  const threshold = Number(u.searchParams.get("threshold") ?? 150);

  const rows = await prisma.target.findMany({
    where: since ? { geocodedAt: { gte: new Date(since) } } : undefined,
    select: { id: true, company: true, latitude: true, longitude: true, geocodeMeta: true },
    take: 1000,
  });

  // If you store previous coords in geocodeMeta.prev, check against them. Here we just return rows missing lat/lon or malformed.
  const bad = rows.filter(r => toNum(r.latitude) == null || toNum(r.longitude) == null);
  const out = bad.map(b => ({ id: b.id, company: b.company, reason: "missing_coords" }));

  return NextResponse.json({ threshold, items: out });
}
