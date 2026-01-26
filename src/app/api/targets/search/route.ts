import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").trim();
  const limit = Math.min(50, Number(u.searchParams.get("limit") || 20));

  if (!q || q.length < 2) return NextResponse.json({ items: [] });

  const items = await prisma.target.findMany({
    where: {
      OR: [
        { company: { contains: q, mode: "insensitive" } },
        { addressRaw: { contains: q, mode: "insensitive" } }
      ]
    },
    take: limit,
    select: {
      id: true,
      company: true,
      addressRaw: true,
      latitude: true,
      longitude: true
    }
  });

  return NextResponse.json({ items });
}
