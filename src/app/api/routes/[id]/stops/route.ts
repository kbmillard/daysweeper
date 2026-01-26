import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { targetIds } = await req.json();
    if (!Array.isArray(targetIds)) {
      return NextResponse.json({ error: "targetIds must be an array" }, { status: 400 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.routeStop.deleteMany({ where: { routeId: id } });
      if (targetIds.length) {
        await tx.routeStop.createMany({
          data: targetIds.map((tid: string, i: number) => ({
            routeId: id,
            targetId: tid,
            seq: i + 1,
          })),
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Replace stops failed" }, { status: 500 });
  }
}
