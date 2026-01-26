import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const slug = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 32);

// GET: list notes for a company
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await prisma.targetNote.findMany({
    where: { targetId: id },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(rows);
}

// POST: { content, tags?:[], userId?:string }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const b = await req.json();
    const content = String(b.content ?? "");
    if (!content.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });
    const tags = (Array.isArray(b.tags) ? b.tags : []).map((t: string) => slug(t)).filter(Boolean).slice(0, 20);
    const userId = b.userId ?? "mobile";
    const note = await prisma.targetNote.create({ data: { targetId: id, content, tags, userId } });
    return NextResponse.json(note, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "create note failed" }, { status: 500 });
  }
}
