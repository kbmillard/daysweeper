import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAPBOX = process.env.MAPBOX_TOKEN;
const num = (n:any) => (Number.isFinite(Number(n)) ? Number(n) : null);

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!MAPBOX) return NextResponse.json({ error: "MAPBOX_TOKEN missing" }, { status: 500 });

  const { id } = await params;

  const route = await prisma.route.findUnique({
    where: { id },
    include: { stops: { orderBy: { seq: "asc" }, include: { target: true } } }
  });
  if (!route) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pts = route.stops.map(s => ({ id: s.id, lat: num(s.target?.latitude), lon: num(s.target?.longitude) }));
  if (pts.some(p => p.lat == null || p.lon == null)) return NextResponse.json({ error: "missing coords" }, { status: 400 });

  const coords = pts.map(p => `${p.lon},${p.lat}`).join(";");
  const url = new URL(`https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coords}`);
  url.searchParams.set("source", "first");
  url.searchParams.set("destination", "last");
  url.searchParams.set("roundtrip", "false");
  url.searchParams.set("overview", "false");
  url.searchParams.set("access_token", MAPBOX);

  const r = await fetch(url.toString());
  if (!r.ok) return NextResponse.json({ error: await r.text().catch(()=> "Mapbox error") }, { status: 502 });
  const j = await r.json();
  const waypoints = Array.isArray(j.waypoints) ? j.waypoints : [];
  const order = waypoints
    .map((w:any, i:number) => ({ inIdx: i, ord: w.waypoint_index }))
    .sort((a:any, b:any)=> a.ord - b.ord)
    .map((x:any)=> x.inIdx);

  await prisma.$transaction(async tx => {
    for (let i=0; i<order.length; i++) {
      const stop = route.stops[order[i]];
      await tx.routeStop.update({ where: { id: stop.id }, data: { seq: i+1 }});
    }
  });
  return NextResponse.json({ ok: true, newOrder: order.map((i:number)=> route.stops[i].id) });
}
