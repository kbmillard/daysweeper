import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAPBOX = process.env.MAPBOX_TOKEN; // set in env

function num(n: any) { const v = Number(n); return Number.isFinite(v) ? v : null; }

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!MAPBOX) return NextResponse.json({ error: "MAPBOX_TOKEN missing" }, { status: 500 });

  const { id } = await params;

  const route = await prisma.route.findUnique({
    where: { id },
    include: {
      stops: {
        orderBy: { seq: "asc" },
        include: { target: { select: { id: true, latitude: true, longitude: true } } }
      }
    }
  });
  if (!route) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pts = route.stops.map(s => {
    const lat = num(s.target?.latitude), lon = num(s.target?.longitude);
    return { stopId: s.id, lat, lon };
  });
  if (pts.some(p => p.lat == null || p.lon == null)) {
    return NextResponse.json({ error: "Some stops missing coordinates" }, { status: 400 });
  }

  const coords = pts.map(p => `${p.lon},${p.lat}`).join(";");
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
  const waypoints: Array<{ waypoint_index: number }> = j.waypoints || [];
  if (!waypoints.length) return NextResponse.json({ error: "No waypoints" }, { status: 500 });

  const order = waypoints
    .map((w, i) => ({ inputIdx: i, orderIdx: w.waypoint_index }))
    .sort((a, b) => a.orderIdx - b.orderIdx)
    .map(x => x.inputIdx);

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < order.length; i++) {
      const stop = route.stops[order[i]];
      await tx.routeStop.update({ where: { id: stop.id }, data: { seq: i + 1 } });
    }
  });

  return NextResponse.json({ ok: true, newOrder: order.map(i => route.stops[i].id) });
}
