import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { targetId } = await req.json();
    if (!targetId) return NextResponse.json({ error: "targetId required" }, { status: 400 });
    const last = await prisma.routeStop.findFirst({
      where: { routeId: id }, orderBy: { seq: "desc" }, select: { seq: true }
    });
    const seq = (last?.seq ?? 0) + 1;
    const s = await prisma.routeStop.create({ data: { routeId: id, targetId, seq } });
    return NextResponse.json({ ok: true, stopId: s.id, seq }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "append failed" }, { status: 500 });
  }
}
