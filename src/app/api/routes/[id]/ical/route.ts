import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createEvents } from "ics";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await prisma.route.findUnique({
    where: { id },
    include: { stops: { orderBy: { seq: "asc" }, include: { target: true } } },
  });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const date = r.scheduledFor ? new Date(r.scheduledFor) : new Date();
  const y = date.getFullYear(), m = date.getMonth()+1, d = date.getDate();

  const events = r.stops.map((s, i) => ({
    title: `${i+1}. ${s.target.company}`,
    description: s.target.addressRaw || "",
    start: [y, m, d, 9 + i, 0] as [number, number, number, number, number], // naive stagger 1h per stop
    duration: { hours: 1 },
    location: s.target.addressRaw || "",
  }));

  const { error, value } = createEvents(events);
  if (error || !value) return NextResponse.json({ error: String(error) }, { status: 500 });

  return new Response(value, {
    headers: { "content-type": "text/calendar", "content-disposition": `attachment; filename="route_${r.id}.ics"` },
  });
}
