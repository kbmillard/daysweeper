import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createEvent } from "ics";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const m = await prisma.meeting.findUnique({ where: { id: params.id } });
  if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
  const start = new Date(m.startAt);
  const end = m.endAt ? new Date(m.endAt) : new Date(start.getTime() + 60 * 60 * 1000);
  const evt = {
    title: m.title,
    start: [start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate(), start.getUTCHours(), start.getUTCMinutes()] as [number, number, number, number, number],
    end: [end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate(), end.getUTCHours(), end.getUTCMinutes()] as [number, number, number, number, number],
    location: m.location || "",
    description: m.notes || "",
    url: process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/companies/${m.targetId}` : undefined
  };
  const { error, value } = createEvent(evt as any);
  if (error) return NextResponse.json({ error: String(error) }, { status: 500 });
  return new Response(value, {
    headers: {
      "content-type": "text/calendar",
      "content-disposition": `attachment; filename="meeting_${m.id}.ics"`
    }
  });
}
