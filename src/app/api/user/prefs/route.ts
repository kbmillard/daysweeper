import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = `user:${userId}:prefs`;
  const row = await prisma.metaKV.findUnique({ where: { key } });
  return NextResponse.json(row?.value ?? { capabilityTags: [], widgets: ["overviewCards", "upcomingMeetings"], searchScopes: ["target", "route", "inventory"] });
}

export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = `user:${userId}:prefs`;
  const payload = await req.json();
  const up = await prisma.metaKV.upsert({ where: { key }, update: { value: payload }, create: { key, value: payload } });
  return NextResponse.json(up.value);
}
