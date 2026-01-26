import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { targetIds } = await req.json();
    if (!Array.isArray(targetIds)) {
      return NextResponse.json({ error: "targetIds must be an array" }, { status: 400 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.routeStop.deleteMany({ where: { routeId: params.id } });
      if (targetIds.length) {
        await tx.routeStop.createMany({
          data: targetIds.map((tid: string, i: number) => ({
            routeId: params.id,
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
