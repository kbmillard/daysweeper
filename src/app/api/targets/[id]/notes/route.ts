import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const slug = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 32);

// GET /api/targets/:id/notes
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await prisma.targetNote.findMany({
    where: { targetId: id },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(rows);
}

/**
 * POST /api/targets/:id/notes
 * body: { content: string, tags?: string[], userId?: string, stopId?: string }
 * Writes a note on the company account (Target). `stopId` is optional context only.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const content: string = (body.content ?? "").toString();
    if (!content.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });

    const tags: string[] = Array.isArray(body.tags) ? body.tags : [];
    const normalized = tags.map(slug).filter(Boolean).slice(0, 20);
    const userId: string = body.userId ?? "mobile";

    const note = await prisma.targetNote.create({
      data: {
        targetId: id,
        content,
        tags: normalized,
        userId
        // If you want to store stopId context, add a column later and set it here.
      }
    });
    return NextResponse.json(note, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "create note failed" }, { status: 500 });
  }
}
