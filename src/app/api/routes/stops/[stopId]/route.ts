import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

type Outcome = "VISITED" | "NO_ANSWER" | "WRONG_ADDRESS" | "FOLLOW_UP";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ stopId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { stopId } = await params;
    const { outcome, note, visitedAt } = await req.json();
    
    if (!outcome) {
      return NextResponse.json({ error: "Outcome required" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.routeStop.findUnique({ 
        where: { id: stopId } 
      });
      
      if (!existing) {
        throw new Error("Stop not found");
      }

      const updatedStop = await tx.routeStop.update({
        where: { id: stopId },
        data: {
          outcome: outcome as Outcome,
          note: note ?? existing.note,
          visitedAt: visitedAt ? new Date(visitedAt) : (existing.visitedAt ?? new Date()),
        },
      });

      // Try to mirror to Target rollups if columns exist
      try {
        await tx.target.update({
          where: { id: updatedStop.targetId },
          data: {
            lastOutcome: outcome,
            lastVisitedAt: updatedStop.visitedAt ?? new Date(),
            ...(outcome === "VISITED" ? { visitedCount: { increment: 1 } } : {}),
            ...(outcome === "NO_ANSWER" ? { noAnswerCount: { increment: 1 } } : {}),
            ...(outcome === "WRONG_ADDRESS" ? { wrongAddressCount: { increment: 1 } } : {}),
            ...(outcome === "FOLLOW_UP" ? { followUpCount: { increment: 1 } } : {}),
          } as any,
        });
      } catch (e) {
        console.warn("Mirror to Target skipped:", (e as any)?.message);
      }

      return updatedStop;
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Outcome update failed" },
      { status: 500 }
    );
  }
}
