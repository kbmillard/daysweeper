import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Outcome = "VISITED"|"NO_ANSWER"|"WRONG_ADDRESS"|"FOLLOW_UP";

export async function PATCH(req: Request, { params }: { params: { stopId: string } }) {
  try {
    const { outcome, note, visitedAt } = await req.json();
    if (!outcome) return NextResponse.json({ error: "Outcome required" }, { status: 400 });

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.routeStop.findUnique({ where: { id: params.stopId } });
      if (!existing) throw new Error("Stop not found");
      const updatedStop = await tx.routeStop.update({
        where: { id: params.stopId },
        data: {
          outcome,
          note: note ?? existing.note,
          visitedAt: visitedAt ? new Date(visitedAt) : (existing.visitedAt ?? new Date()),
        },
      });
      // Try to mirror to Target rollups if columns exist
      try {
        const inc = {
          visitedCount:      outcome === "VISITED" ? 1 : 0,
          noAnswerCount:     outcome === "NO_ANSWER" ? 1 : 0,
          wrongAddressCount: outcome === "WRONG_ADDRESS" ? 1 : 0,
          followUpCount:     outcome === "FOLLOW_UP" ? 1 : 0,
        } as any;
        await tx.target.update({
          where: { id: updatedStop.targetId },
          data: {
            lastOutcome: outcome,
            lastVisitedAt: updatedStop.visitedAt ?? new Date(),
            ...(inc.visitedCount ? { visitedCount: { increment: 1 } } : {}),
            ...(inc.noAnswerCount ? { noAnswerCount: { increment: 1 } } : {}),
            ...(inc.wrongAddressCount ? { wrongAddressCount: { increment: 1 } } : {}),
            ...(inc.followUpCount ? { followUpCount: { increment: 1 } } : {}),
          } as any,
        });
      } catch (e) {
        console.warn("Mirror to Target skipped:", (e as any)?.message);
      }
      return updatedStop;
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Outcome update failed" }, { status: 500 });
  }
}
