import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const targetId = u.searchParams.get("targetId") ?? undefined;
  const routeId = u.searchParams.get("routeId") ?? undefined;
  // const since = u.searchParams.get("since"); // optional filter for future use
  const rows = await prisma.meeting.findMany({
    where: {
      ...(targetId ? { targetId } : {}),
      ...(routeId ? { routeId } : {})
    },
    orderBy: { startAt: "asc" }
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const created = await prisma.meeting.create({
      data: {
        title: String(b.title || "Meeting"),
        startAt: new Date(b.startAt),
        endAt: b.endAt ? new Date(b.endAt) : null,
        targetId: b.targetId ?? null,
        routeId: b.routeId ?? null,
        routeStopId: b.routeStopId ?? null,
        location: b.location ?? null,
        notes: b.notes ?? null,
        attendees: Array.isArray(b.attendees) ? b.attendees.slice(0, 50) : [],
        createdById: b.createdById ?? null,
        calendarProvider: b.calendarProvider ?? null
      }
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "create meeting failed" }, { status: 500 });
  }
}
