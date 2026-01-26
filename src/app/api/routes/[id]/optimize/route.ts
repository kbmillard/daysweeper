import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAPBOX = process.env.MAPBOX_TOKEN; // set in Vercel env as MAPBOX_TOKEN

function toNum(n: any) {
  if (n == null) return null;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!MAPBOX) return NextResponse.json({ error: "MAPBOX_TOKEN missing" }, { status: 500 });

  const { id } = await params;

  // 1) Load stops with coords
  const route = await prisma.route.findUnique({
    where: { id },
    include: { stops: { orderBy: { seq: "asc" }, include: { target: true } } },
  });
  if (!route) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pts = route.stops.map(s => {
    const lat = toNum(s.target?.latitude);
    const lon = toNum(s.target?.longitude);
    return { stopId: s.id, targetId: s.targetId, lat, lon };
  });

  const bad = pts.filter(p => p.lat == null || p.lon == null);
  if (bad.length) {
    return NextResponse.json({
      error: "Some stops missing coordinates",
      missing: bad.map(b => b.targetId),
    }, { status: 400 });
  }

  // 2) Build coordinates string in lon,lat order (Mapbox format)
  const coords = pts.map(p => `${p.lon},${p.lat}`).join(";");

  // Prefer fixed start and fixed end if you already order the first/last
  const url = new URL(`https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coords}`);
  url.searchParams.set("source", "first");
  url.searchParams.set("destination", "last");
  url.searchParams.set("roundtrip", "false");
  url.searchParams.set("overview", "false");
  url.searchParams.set("access_token", MAPBOX);

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    return NextResponse.json({ error: "Mapbox error", detail: t }, { status: 502 });
  }
  const j = await resp.json();

  // 3) Mapbox waypoints carry waypoint_index (new order)
  const waypoints: Array<{ waypoint_index: number; waypoint?: number; name?: string }> = j.waypoints || [];
  if (!waypoints.length) return NextResponse.json({ error: "No waypoints returned" }, { status: 500 });

  // Build new order indices for our pts; Mapbox preserves input order in waypoints array
  const order = waypoints
    .map((w, i) => ({ inputIdx: i, orderIdx: w.waypoint_index }))
    .sort((a, b) => a.orderIdx - b.orderIdx)
    .map(x => x.inputIdx);

  // 4) Write new seq to DB (1..n)
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < order.length; i++) {
      const stop = route.stops[order[i]];
      await tx.routeStop.update({ where: { id: stop.id }, data: { seq: i + 1 } });
    }
  });

  return NextResponse.json({ ok: true, newOrder: order.map(i => route.stops[i].id) });
}
