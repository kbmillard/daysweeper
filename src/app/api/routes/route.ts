import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const assignedTo = u.searchParams.get("assignedTo") ?? undefined;

  const routes = await prisma.route.findMany({
    where: assignedTo ? { assignedToUserId: assignedTo } : undefined,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { stops: true } } },
  });

  return NextResponse.json(routes);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.name || !String(body.name).trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const created = await prisma.route.create({
      data: {
        name: String(body.name).trim(),
        assignedToUserId: body.assignedToUserId ?? null,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Create failed" }, { status: 500 });
  }
}
