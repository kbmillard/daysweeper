import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const route = await prisma.route.findUnique({
    where: { id },
    include: {
      stops: { orderBy: { seq: "asc" }, include: { target: { select: { id: true, company: true, addressRaw: true } } } }
    },
  });
  if (!route) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(route);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const b = await req.json();
    const data: any = {};
    if (b.name !== undefined) data.name = String(b.name).trim();
    if (b.assignedToUserId !== undefined) data.assignedToUserId = b.assignedToUserId || null;
    if (b.scheduledFor !== undefined) data.scheduledFor = b.scheduledFor ? new Date(b.scheduledFor) : null;

    const updated = await prisma.route.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.route.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Delete failed" }, { status: 500 });
  }
}
