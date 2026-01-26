import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const slug = (s: string) => s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 64);

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const items = await prisma.targetNote.findMany({
    where: { targetId: params.id },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(items);
}

// POST { content, tags?:string[], userId?:string, routeId?, routeStopId?, mentions?:string[] }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const b = await req.json();
    const content = String(b.content ?? "");
    if (!content.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });
    const tags: string[] = (b.tags || []).map((t: string) => slug(t)).slice(0, 50);
    const mentions: string[] = Array.isArray(b.mentions) ? b.mentions.map((m: string) => slug(m)).slice(0, 100) : [];

    const note = await prisma.targetNote.create({
      data: {
        targetId: params.id,
        content,
        tags,
        userId: b.userId ?? "web",
        routeId: b.routeId ?? null,
        routeStopId: b.routeStopId ?? null,
        mentions
      }
    });
    return NextResponse.json(note, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "create note failed" }, { status: 500 });
  }
}
