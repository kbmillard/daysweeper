import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const route = await prisma.route.findUnique({
    where: { id: params.id },
    include: {
      stops: {
        orderBy: { seq: "asc" },
        include: { target: { select: { id: true, company: true, addressRaw: true } } },
      },
    },
  });
  if (!route) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(route);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data: any = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.assignedToUserId !== undefined) data.assignedToUserId = body.assignedToUserId || null;
    if (body.scheduledFor !== undefined) data.scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : null;
    const updated = await prisma.route.update({ where: { id: params.id }, data });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.route.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Delete failed" }, { status: 500 });
  }
}
